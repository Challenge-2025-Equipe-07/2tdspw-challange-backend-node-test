Aqui estão todos os detalhes, requisitos técnicos, regras do vídeo, configurações da Azure e critérios de avaliação com penalidades especificamente para a disciplina de DevOps Tools & Cloud Computing na Sprint 4 (2º semestre):
🎯 1. Objetivo Geral da Entrega
A equipe deve implementar e implantar uma solução desenvolvida em Java Advanced ou Advanced Business Development with .NET, integrada a um banco de dados na nuvem
. O foco central desta sprint é utilizar a plataforma Azure DevOps integrada com os recursos da Azure para construir e executar esteiras automatizadas de Integração Contínua (CI) e Entrega Contínua (CD)
.
📄 2. Formato da Entrega Obrigatória no Portal FIAP
A submissão no portal da FIAP deve ser feita exclusivamente através de um único arquivo PDF contendo apenas
:
Folha de identificação: Nome completo, RM e turma de todos os integrantes
.
Links obrigatórios:
Link do repositório no GitHub
.
Link do vídeo demonstrativo no YouTube
.
Link do projeto no Azure DevOps
.
(Nenhum outro conteúdo deve ser colocado no PDF; todas as orientações, scripts e diagramas devem estar organizados no README do repositório)
.
🏢 3. Configuração do Projeto no Azure DevOps e Acesso ao Professor
O projeto na plataforma Azure DevOps deve ser criado com as seguintes especificações exatas
:
Project Name: Sprint 4 – Azure DevOps
.
Description: Projeto para entrega da Sprint 4 do professor <nome do professor> com a listagem dos integrantes (exemplo: <RM00000> - <nome do aluno> - <turma 2TDS..>)
.
Visibility: Private
.
Version Control: Git
.
Work Item Process: Scrum ou Agile
.
Permissão do Professor (CRÍTICO): O professor deve ser convidado para a organização com o perfil de acesso Basic e configurado como Administrador do projeto
. Sem esse acesso correto, o projeto não poderá ser corrigido e a nota será zerada
.
🗄️ 4. Requisitos do Banco de Dados em Nuvem
Bancos Permitidos: Bancos em containers na nuvem ou serviços PaaS (MySQL, PostgreSQL, Azure SQL PaaS, Oracle em Container na Nuvem ou o banco Oracle da FIAP)
.
Banco Não Permitido: O banco em memória H2 não é aceito sob nenhuma hipótese
.
Script SQL: Incluir o DDL das tabelas principais da aplicação em um arquivo script_bd.sql separado
.
⚙️ 5. Regras Obrigatórias das Pipelines de CI/CD
As esteiras podem ser configuradas via YAML ou no modo Clássico
:
Continuous Integration (CI):
Estar conectada ao repositório Git e configurada para disparar automaticamente a cada commit ou alteração na branch master
.
Conter obrigatoriamente uma etapa de execução de testes automatizados
.
Realizar a geração e publicação do artefato de compilação no ambiente do Azure DevOps
.
Continuous Deployment (CD):
Disparar automaticamente assim que um novo artefato for gerado pela esteira de CI
.
Realizar o deploy e provisionar a aplicação em um dos seguintes serviços da Azure: Azure Web App ou Azure Container Instance (ACI)
.
Segurança:
Todas as variáveis sensíveis (usuários, senhas e tokens) devem estar protegidas e criptografadas como variáveis de ambiente
.
📐 6. Documentação no README e Diagrama de Arquitetura
O arquivo [link suspeito removido] no repositório GitHub deve contemplar
:
Descrição da Solução e Stack: Explicação do que a aplicação faz e quais tecnologias foram empregadas
.
Diagrama da Arquitetura + Fluxo CI/CD (Até 20 pontos):
Desenho mostrando todos os componentes da stack de tecnologia e infraestrutura
.
Mapeamento numérico da ordem das etapas no fluxo das esteiras CI/CD
.
Indicação explicita das personas (desenvolvedor, usuário final, etc.), setas/linhas de conexão e a atuação de cada ferramenta
. (Atenção: desenhos genéricos no estilo UML, TOGAF ou fluxogramas comuns não serão aceitos)
.
📹 7. Roteiro e Requisitos do Vídeo Demonstrativo (Até 80 pontos)
O vídeo é a principal prova técnica da entrega e deve atender aos seguintes critérios
:
Requisitos do Arquivo: Qualidade mínima de 720p, áudio limpo com explicação falada por um integrante (vídeos mudos ou apenas com legendas serão penalizados)
.
Roteiro Sequencial da Gravação:
Apresentar as ferramentas abertas (IDE, Azure DevOps, Banco de Dados, Portal Azure)
.
Mostrar as configurações de jobs e tasks das pipelines
.
Efetuar uma alteração visível no código-fonte (ex: alterar um título ou label da interface/resposta da API)
. (Alterar apenas o README para forçar o build gerará penalidade)
.
Realizar o commit/push na branch master e demonstrar o disparo automático do CI/CD
.
Explicar verbalmente cada etapa da esteira em execução
.
Exibir a geração do artefato e os resultados dos testes automatizados
.
Acessar o Portal da Azure para comprovar o recurso atualizado pelo deploy (Web App ou ACI)
.
Acessar a aplicação rodando online e realizar o CRUD completo, comprovando a persistência dos dados diretamente no SGBD em nuvem através de comandos SELECT
.
💯 8. Distribuição de Pontos e Tabela de Penalidades
Pontuação Máxima (100 pontos):
Diagrama da Arquitetura + Fluxo CI/CD: Até 20 pontos
.
Vídeo Demonstrativo da Solução e Persistência: Até 80 pontos
.
Critérios que Anulam a Nota (Nota ZERO):
Aplicação entregue ou rodando em LOCALHOST
.
Submissão realizada fora da data e horário estipulados
.
Professor sem acesso ao repositório, ao vídeo ou sem acesso Basic/Admin no Azure DevOps
.
Não configurar o projeto no Azure DevOps
.
Pipeline de CI ou CD quebrada ou não funcional
.
Descontos e Penalidades Específicas:
-40 pontos: Utilizar banco de dados não permitido (ex: H2)
.
-30 pontos: Ausência do arquivo PDF com links e identificação do grupo
.
-30 pontos: Vídeo com baixa qualidade ou sem explicação falada por voz
.
-30 pontos: Não evidenciar cada operação do CRUD no banco de dados via SELECT
.
-30 pontos: Esteiras CI/CD que não disparam automaticamente com commit na branch master
.
-30 pontos: Não realizar o deploy no Azure Web App ou ACI
.
-30 pontos: Não demonstrar a execução da aplicação com a alteração do código efetuada
.
-20 pontos: Fazer alteração apenas no README para disparar a pipeline
.
-20 pontos: Ausência de testes automatizados na etapa de CI
.
-20 pontos: Não publicar os artefatos na etapa de CI
.
-20 pontos: Não explicar cada etapa do CI/CD durante a execução no vídeo
.
-20 pontos: Apresentar diagrama de arquitetura genérico (estilo UML/TOGAF)
.
-15 pontos: Deixar variáveis de ambiente sensíveis (senhas, tokens) desprotegidas
.
-10 pontos: Não incluir a descrição da solução no README
.
-10 pontos: Não mostrar os recursos atualizados diretamente no portal da Azure
.