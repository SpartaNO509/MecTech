const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const pool = require("./config/database");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));

app.use(session({
    secret: process.env.SESSION_SECRET || 'chave_secreta_mectech_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use((req, res, next) => {
    res.locals.usuario = req.session.usuarioLogado || null;
    next();
});
app.locals.moeda = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function testarConexao() {
    try {
        const connection = await pool.getConnection();
        console.log(" Conexão segura (SSL) realizada com o MySQL no Aiven!");
        connection.release();
    } catch (err) {
        console.error(" Erro crítico ao conectar no Aiven:", err.message);
    }
}
testarConexao();

function verificarAutenticacao(req, res, next) {
    if (req.session.usuarioLogado) return next();
    res.redirect("/login");
}

function verificarAdmin(req, res, next) {
    if (!req.session.usuarioLogado) {
        return res.redirect("/login");
    }
    if (req.session.usuarioLogado.nivel_acesso !== "admin") {
        return res.status(403).send("<h2>Acesso negado.</h2><p>Esta área é exclusiva para administradores.</p><a href='/'>Voltar ao início</a>");
    }
    next();
}

function validarProduto(dados) {
    const preco = Number(dados.preco);
    const estoque = Number(dados.estoque);

    if (!dados.nome || dados.nome.trim() === "") return "Informe o nome do produto.";
    if (!dados.marca || dados.marca.trim() === "") return "Informe a marca do produto.";
    if (isNaN(preco) || preco < 0) return "Preço inválido.";
    if (!Number.isInteger(estoque) || estoque < 0) return "Estoque inválido (use número inteiro).";
    return null;
}

app.use("/", require("../routes"));

app.get("/login", (req, res) => res.render("login", { erro: null }));

app.post("/registrar", async (req, res) => {
    const { nome, telefone, email, senha } = req.body;
    try {
        const senhaCriptografada = await bcrypt.hash(senha, 10);
        await pool.query("INSERT INTO clientes (nome, telefone, email, senha) VALUES (?, ?, ?, ?)", [nome, telefone, email, senhaCriptografada]);
        res.render("login", { erro: "Cadastro realizado com sucesso! Faça login." });
    } catch (error) {
        res.render("login", { erro: "Erro ao cadastrar. E-mail em uso." });
    }
});

app.post("/login", async (req, res) => {
    const { email, senha } = req.body;
    try {
        const [rows] = await pool.query("SELECT * FROM clientes WHERE email = ?", [email]);
        if (rows.length === 0) return res.render("login", { erro: "E-mail ou senha incorretos." });
        const cliente = rows[0];
        if (await bcrypt.compare(senha, cliente.senha)) {
            req.session.usuarioLogado = {
                id: cliente.id_cliente,
                nome: cliente.nome,
                nivel_acesso: cliente.nivel_acesso
            };
            if (cliente.nivel_acesso === "admin") {
                return res.redirect("/admin/produtos");
            }
            return res.redirect("/");
        }
        res.render("login", { erro: "E-mail ou senha incorretos." });
    } catch (error) {
        res.render("login", { erro: "Erro interno no login." });
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

app.post("/comprar", verificarAutenticacao, async (req, res) => {
    const { id_produto, quantidade } = req.body;
    const cliente = req.session.usuarioLogado;
    try {
        const [rows] = await pool.query("SELECT * FROM produtos WHERE id_produto = ?", [id_produto]);
        if (rows.length === 0) return res.status(404).send("Produto inexistente.");
        const produto = rows[0];
        const qtd = parseInt(quantidade);

        if (produto.estoque < qtd) return res.send("<h2> Estoque insuficiente.</h2><a href='/'>Voltar</a>");

        await pool.query("UPDATE produtos SET estoque = estoque - ? WHERE id_produto = ?", [qtd, id_produto]);
        await pool.query("INSERT INTO vendas_produtos (id_cliente, id_produto, quantidade, preco_venda) VALUES (?, ?, ?, ?)", [cliente.id, id_produto, qtd, produto.preco * qtd]);
        res.send(`<h2> Sucesso!</h2><p>Pedido registrado para ${produto.nome}.</p><a href='/'>Voltar à vitrine</a>`);
    } catch (error) {
        res.status(500).send("Erro ao finalizar pedido.");
    }
});

app.get("/admin/produtos", verificarAdmin, async (req, res, next) => {
    try {
        const [produtos] = await pool.query("SELECT * FROM produtos");
        res.render("admin-produtos", { produtos, produtoEditar: null });
    } catch (e) {
        next(e);
    }
});

app.post("/admin/produtos/salvar", verificarAdmin, async (req, res, next) => {
    try {
        const erroValidacao = validarProduto(req.body);
        if (erroValidacao) {
            return res.status(400).send("<h2>" + erroValidacao + "</h2><a href='/admin/produtos'>Voltar</a>");
        }
        const { nome, marca, preco, estoque, observacoes } = req.body;
        await pool.query(
            "INSERT INTO produtos (nome, marca, preco, estoque, observacoes) VALUES (?, ?, ?, ?, ?)",
            [nome.trim(), marca.trim(), preco, estoque, observacoes || null]
        );
        res.redirect("/admin/produtos");
    } catch (e) {
        next(e);
    }
});

app.get("/admin/produtos/editar/:id", verificarAdmin, async (req, res, next) => {
    try {
        const [produtos] = await pool.query("SELECT * FROM produtos");
        const [p] = await pool.query("SELECT * FROM produtos WHERE id_produto = ?", [req.params.id]);
        res.render("admin-produtos", { produtos, produtoEditar: p[0] || null });
    } catch (e) {
        next(e);
    }
});

app.post("/admin/produtos/atualizar/:id", verificarAdmin, async (req, res, next) => {
    try {
        const erroValidacao = validarProduto(req.body);
        if (erroValidacao) {
            return res.status(400).send("<h2>" + erroValidacao + "</h2><a href='/admin/produtos'>Voltar</a>");
        }
        const { nome, marca, preco, estoque, observacoes } = req.body;
        await pool.query(
            "UPDATE produtos SET nome=?, marca=?, preco=?, estoque=?, observacoes=? WHERE id_produto=?",
            [nome.trim(), marca.trim(), preco, estoque, observacoes || null, req.params.id]
        );
        res.redirect("/admin/produtos");
    } catch (e) {
        next(e);
    }
});

app.get("/admin/produtos/excluir/:id", verificarAdmin, async (req, res, next) => {
    try {
        await pool.query("DELETE FROM produtos WHERE id_produto = ?", [req.params.id]);
        res.redirect("/admin/produtos");
    } catch (e) {
        next(e);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(" MecTech rodando em http://localhost:" + PORT));