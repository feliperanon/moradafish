Aqui está o `README.md` completo já alinhado com o seu plano de desenvolvimento que está nos PDFs.

Você pode criar esse arquivo na raiz do seu projeto (`C:\code\moradafish\README.md`) e depois fazer o commit e push.

---

```markdown
# 🐟 Morada Fish – Painel de Produtividade da Filetagem de Tilápias

Sistema web para registro e análise de produtividade na filetagem de tilápias, integrando dados em tempo real com o **Firebase Firestore**, interface em **React + Tailwind CSS** e gráficos interativos para gestão de desempenho.

---

## 🚀 Tecnologias Utilizadas

- **React** + Vite (SPA)
- **Tailwind CSS** (estilização)
- **Firebase** (Firestore e Authentication)
- **React Router DOM** (navegação)
- **Recharts** (dashboards e gráficos)
- **Leitura de código de barras** (Bematech / dispositivos USB)
- **Integração com balança** via driver **CH34x**
- **JavaScript ES6+**

---

## 📁 Estrutura de Pastas

```

/src
/pages
\- LoginPage.jsx
\- HomePage.jsx
\- ProductionPage.jsx
\- RegistrationPage.jsx
\- MonthlyDashboard.jsx
\- DailyEvaluationPage.jsx
\- ConsultationPage.jsx
\- AwardsPage.jsx
\- ProcessYieldEntryPage.jsx
\- RendFiletadorExcelPage.jsx
\- TesteEscamacaoPage.jsx
/components
\- Navbar.jsx
\- MainLayout.jsx
\- ConfirmationModal.jsx
\- StatCard.jsx
/services
\- firebase.js
\- authService.js
\- balancaService.js
/utils
\- calculations.js
\- formatters.js

````

---

## 🔐 Perfis de Acesso

- **Administrador** – Acesso completo a todas as funções
- **Gerente** – Autorizações e análise de relatórios
- **Operador** – Registro de produção (entrada/saída/refugo)
- **Analítico** – Somente leitura de dashboards e relatórios

---

## 🧭 Plano de Desenvolvimento

### **Fase 1 – Estrutura Inicial e Ambiente**
- Organização modular do projeto no VS Code
- Configuração do Tailwind CSS
- Instalação de dependências:
  ```bash
  npm install firebase react-router-dom recharts react-barcode-reader
````

### **Fase 2 – Login e Controle de Acesso**

* Autenticação com Firebase
* Perfis: admin, gerente, operador, analítico
* Proteção de rotas por perfil

### **Fase 3 – Integração com Produção**

* Seleção de fornecedor e peso do lote
* Botões touch para:

  * Entrada de Peixe
  * Entrada de Filé
  * Refugo de Peixe
  * Refugo de Filé
* Leitura automática da balança CH34x
* Bloqueio de leituras duplicadas (< 2 minutos)
* Ajuste manual de peso quando necessário

### **Fase 4 – Cadastro e Leitura de Colaboradores**

* Registro via código de barras
* Nome, função, matrícula, rendimento esperado
* Bloqueio de duplicidade de leitura

### **Fase 5 – Painel Mensal e Diário**

* **Dashboard mensal:** gráficos por rendimento, volume e horas
* **Avaliação diária:** indicadores de produção e rendimento
* Filtros por período (dia, semana, mês)

### **Fase 6 – Banco de Dados (Firestore)**

* Estrutura de coleções:

  ```
  colaboradores
  fornecedores
  producoes
  avaliacoes
  usuarios
  ```
* Salvamento automático após cada registro

### **Fase 7 – Ajustes Finais**

* Layout fixo com menu lateral
* Botões de logout e notificações
* Otimização para telas touch

---

## 📌 Como Rodar Localmente

1. **Clonar repositório:**

   ```bash
   git clone https://github.com/feliperanon/moradafish.git
   ```

2. **Entrar na pasta:**

   ```bash
   cd moradafish
   ```

3. **Instalar dependências:**

   ```bash
   npm install
   ```

4. **Configurar Firebase:**

   * Criar projeto no Firebase
   * Pegar as credenciais
   * Criar arquivo `src/services/firebase.js` com:

     ```javascript
     import { initializeApp } from "firebase/app";
     import { getAuth } from "firebase/auth";
     import { getFirestore } from "firebase/firestore";

     const firebaseConfig = {
       apiKey: "SUA_API_KEY",
       authDomain: "SEU_AUTH_DOMAIN",
       projectId: "SEU_PROJECT_ID",
       storageBucket: "SEU_STORAGE_BUCKET",
       messagingSenderId: "SEU_MESSAGING_SENDER_ID",
       appId: "SEU_APP_ID",
     };

     const app = initializeApp(firebaseConfig);
     export const auth = getAuth(app);
     export const db = getFirestore(app);
     ```

5. **Rodar projeto:**

   ```bash
   npm run dev
   ```

---

## 🤝 Contribuição

Pull requests são bem-vindos. Para mudanças grandes, abra um *issue* antes.

---

🧠 **Desenvolvido por Felipe Ranon • Morada Fish**

```

---

Se quiser, eu já posso te mandar também **o `.gitignore` otimizado** para esse projeto, assim você evita subir arquivos desnecessários para o GitHub.  
Quer que eu já faça?
```
