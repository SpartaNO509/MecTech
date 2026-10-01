const express = require("express");

const router = express.Router();


// Página principal
router.get("/", (req, res) => {

    res.render("principal");

});


// Página de serviços
router.get("/servicos", (req, res) => {

    res.render("servicos");

});


// Cadastrar serviço
router.post("/servicos", (req, res) => {

    const {
        nome,
        telefone,
        carro,
        placa,
        problema
    } = req.body;


    const sql = `
        INSERT INTO servicos
        (nome, telefone, carro, placa, problema)
        VALUES (?, ?, ?, ?, ?)
    `;


    req.conexao.query(
        sql,
        [nome, telefone, carro, placa, problema],
        (erro) => {

            if (erro) {

                console.log(erro);

                return res.send(
                    "Erro ao cadastrar o serviço."
                );

            }


            res.send(
                "Serviço cadastrado com sucesso!"
            );

        }
    );

});


module.exports = router;