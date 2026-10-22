USE defaultdb;

DROP TABLE IF EXISTS vendas_produtos;
DROP TABLE IF EXISTS produtos;
DROP TABLE IF EXISTS clientes;

CREATE TABLE clientes (
    id_cliente INT AUTO_INCREMENT PRIMARY KEY,
    cpf VARCHAR(14) UNIQUE,
    nome VARCHAR(100) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL
);

CREATE TABLE produtos (
    id_produto INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    marca VARCHAR(50) NOT NULL,
    preco DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    estoque INT NOT NULL DEFAULT 0,
    observacoes VARCHAR(255)
);

CREATE TABLE vendas_produtos (
    id_venda_produto INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_produto INT NOT NULL,
    momento_venda DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    quantidade INT NOT NULL DEFAULT 1,
    preco_venda DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    FOREIGN KEY (id_produto) REFERENCES produtos(id_produto) ON DELETE CASCADE
);

INSERT INTO produtos (nome, marca, preco, estoque, observacoes) VALUES
('Óleo de Motor 5W30 Sintético', 'Castrol', 45.90, 50, 'Recomendado para motores modernos'),
('Filtro de Óleo Monofluxo', 'Fram', 29.90, 30, 'Alta eficiência de filtragem'),
('Pastilha de Freio Dianteira', 'Fras-le', 89.90, 15, 'Kit completo para duas rodas');
