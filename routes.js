const express = require("express");


module.exports = (pool) => {
    const router = express.Router();

    
    router.get("/", async (req, res, next) => {
        try {
            const [destaques] = await pool.query(
                "SELECT id_produto, nome, marca, preco, estoque, observacoes FROM produtos WHERE estoque > 0 ORDER BY id_produto DESC LIMIT 3"
            );
            const [[resumo]] = await pool.query(
                "SELECT COUNT(*) AS total_produtos, COUNT(DISTINCT marca) AS total_marcas FROM produtos WHERE estoque > 0"
            );
            res.render("home", { destaques, resumo });
        } catch (erro) {
            next(erro);
        }
    });

    
    router.get("/produtos", async (req, res, next) => {
        try {
            const busca = (req.query.busca || "").trim();
            const marca = (req.query.marca || "").trim();

            let sql = "SELECT id_produto, nome, marca, preco, estoque, observacoes FROM produtos WHERE estoque > 0";
            const params = [];

            if (busca) {
                sql += " AND (nome LIKE ? OR observacoes LIKE ?)";
                params.push(`%${busca}%`, `%${busca}%`);
            }
            if (marca) {
                sql += " AND marca = ?";
                params.push(marca);
            }
            sql += " ORDER BY nome";

            const [produtos] = await pool.query(sql, params);
            const [marcas] = await pool.query(
                "SELECT DISTINCT marca FROM produtos WHERE estoque > 0 ORDER BY marca"
            );

            res.render("produtos", { produtos, marcas, busca, marca });
        } catch (erro) {
            next(erro);
        }
    });

    
    router.get("/produtos/:id", async (req, res, next) => {
        try {
            const id = Number(req.params.id);
            if (!Number.isInteger(id)) return res.status(404).render("404");

            const [rows] = await pool.query("SELECT * FROM produtos WHERE id_produto = ?", [id]);
            if (rows.length === 0) return res.status(404).render("404");

            const produto = rows[0];
            const [relacionados] = await pool.query(
                "SELECT id_produto, nome, marca, preco FROM produtos WHERE marca = ? AND id_produto <> ? AND estoque > 0 LIMIT 3",
                [produto.marca, id]
            );

            res.render("detalhes", { produto, relacionados });
        } catch (erro) {
            next(erro);
        }
    });

    // SOBRE: institucional + números vindos do banco
    router.get("/sobre", async (req, res, next) => {
        try {
            const [[stats]] = await pool.query(
                "SELECT COUNT(*) AS total_produtos, COUNT(DISTINCT marca) AS total_marcas, COALESCE(SUM(estoque), 0) AS total_estoque FROM produtos"
            );
            res.render("sobre", { stats });
        } catch (erro) {
            next(erro);
        }
    });

    return router;
};
