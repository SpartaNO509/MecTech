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

// Disponibiliza o usuário logado e o formatador de moeda para todas as views
app.use((req, res, next) => {
    res.locals.usuario = req.session.usuarioLogado || null;
    next();
});
app.locals.moeda = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

(async () => {
    try {
        const connection = await pool.getConnection();
        console.log("✅ Conexão segura (SSL) realizada com o MySQL no Aiven!");
        connection.release();
    } catch (err) {
        console.error("❌ Erro crítico ao conectar no Aiven:", err.message);
    }
})();

function verificarAutenticacao(req, res, next) {
    if (req.session.usuarioLogado) return next();
    res.redirect("/login");
}

// Rotas públicas (Home, Produtos, Detalhes, Sobre) - ver routes.js
app.use("/", require("../routes")(pool));

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
            req.session.usuarioLogado = { id: cliente.id_cliente, nome: cliente.nome };
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

        if (produto.estoque < qtd) return res.send("<h2>❌ Estoque insuficiente.</h2><a href='/'>Voltar</a>");

        await pool.query("UPDATE produtos SET estoque = estoque - ? WHERE id_produto = ?", [qtd, id_produto]);
        await pool.query("INSERT INTO vendas_produtos (id_cliente, id_produto, quantidade, preco_venda) VALUES (?, ?, ?, ?)", [cliente.id, id_produto, qtd, produto.preco * qtd]);
        res.send(`<h2>✅ Sucesso!</h2><p>Pedido registrado para ${produto.nome}.</p><a href='/'>Voltar à vitrine</a>`);
    } catch (error) {
        res.status(500).send("Erro ao finalizar pedido.");
    }
});

app.get("/admin/produtos", verificarAutenticacao, async (req, res, next) => { try {
    const [produtos] = await pool.query("SELECT * FROM produtos");
    res.render("admin-produtos", { produtos, produtoEditar: null });
} catch (e) { next(e); } });

app.post("/admin/produtos/salvar", verificarAutenticacao, async (req, res, next) => { try {
    const { nome, marca, preco, estoque, observacoes } = req.body;
    await pool.query("INSERT INTO produtos (nome, marca, preco, estoque, observacoes) VALUES (?, ?, ?, ?, ?)", [nome, marca, preco, estoque, observacoes]);
    res.redirect("/admin/produtos");
} catch (e) { next(e); } });

app.get("/admin/produtos/editar/:id", verificarAutenticacao, async (req, res, next) => { try {
    const [produtos] = await pool.query("SELECT * FROM produtos");
    const [p] = await pool.query("SELECT * FROM produtos WHERE id_produto = ?", [req.params.id]);
    res.render("admin-produtos", { produtos, produtoEditar: p[0] || null });
} catch (e) { next(e); } });

app.post("/admin/produtos/atualizar/:id", verificarAutenticacao, async (req, res, next) => { try {
    const { nome, marca, preco, estoque, observacoes } = req.body;
    await pool.query("UPDATE produtos SET nome=?, marca=?, preco=?, estoque=?, observacoes=? WHERE id_produto=?", [nome, marca, preco, estoque, observacoes, req.params.id]);
    res.redirect("/admin/produtos");
} catch (e) { next(e); } });

app.get("/admin/produtos/excluir/:id", verificarAutenticacao, async (req, res, next) => { try {
    await pool.query("DELETE FROM produtos WHERE id_produto = ?", [req.params.id]);
    res.redirect("/admin/produtos");
} catch (e) { next(e); } });

// 404 e tratamento de erros
app.use((req, res) => res.status(404).render("404"));
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render("erro");
});

app.listen(3000, () => console.log("🚀 MecTech rodando em http://localhost:3000"));
