const express = require("express");

const app = express();

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));


// Página principal
app.get("/", (req, res) => {
    res.render("principal");
});


// Página de serviços
app.get("/servicos", (req, res) => {
    res.render("servicos");
});


// Apenas para visualizar o formulário
app.post("/servicos", (req, res) => {
    res.send("Serviço enviado! Backend será feito depois.");
});


app.listen(3000, () => {
    console.log("Servidor rodando em http://localhost:3000");
});