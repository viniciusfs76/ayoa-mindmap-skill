// ayoa-learn.js — Ciclo adaptativo: diagnosticar, aprender, testar
//
// Uso:
//   node ayoa-learn.js --case <nome> --error "<desc>" --symptom "<sintoma>" --fix "<correcao>" [--test-create]
//
// Este script registra um novo caso aprendido, cria/atualiza testes,
// e opcionalmente valida regressão.
//
// Exemplo:
//   node ayoa-learn.js --case "BotaoX sumiu" --error "toggle-foo not found" \
//     --symptom "Botao X nao aparece na toolbar apos atualizacao" \
//     --fix "Procurar em .toolbar-foo em vez de #foo-btn"

const fs = require('fs');
const path = require('path');

const SKILL_DIR = path.resolve(__dirname, '..');
const LEARNED_FILE = path.join(SKILL_DIR, 'references', 'ayoa-learned-cases.md');
const PITFALLS_FILE = path.join(SKILL_DIR, 'references', 'pitfalls.md');
const SKILL_MD = path.join(SKILL_DIR, 'SKILL.md');

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i].startsWith('--')) {
      const key = process.argv[i].slice(2);
      const val = process.argv[i + 1];
      if (val && !val.startsWith('--')) { args[key] = val; i++; }
      else { args[key] = true; }
    }
  }
  return args;
}

function getNextCaseNum() {
  const content = fs.readFileSync(LEARNED_FILE, 'utf-8');
  const match = content.match(/Caso #(\d+)/g);
  if (!match) return 1;
  const nums = match.map(m => parseInt(m.match(/\d+/)[0]));
  return Math.max(...nums) + 1;
}

function getCurrentVersion() {
  const content = fs.readFileSync(SKILL_MD, 'utf-8');
  const match = content.match(/version: (\d+\.\d+\.\d+)/);
  if (!match) return '1.0.0';
  const parts = match[1].split('.').map(Number);
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

const ARGS = parseArgs();
const CASE_NAME = ARGS.case || 'Caso sem nome';
const ERROR_DESC = ARGS.error || '(sem descrição)';
const SYMPTOM = ARGS.symptom || '(sem sintoma)';
const FIX = ARGS.fix || '(sem correção)';
const TEST_CREATE = ARGS['test-create'] || false;

const newVersion = getCurrentVersion();
const caseNum = getNextCaseNum();
const date = new Date().toISOString().slice(0, 10);

// Build new case entry
const caseEntry = `
---

## Caso #${String(caseNum).padStart(3, '0')} — ${CASE_NAME}

**Data:** ${date}
**Scripts afetados:** (listar)

### Problema
- **Sintoma:** ${SYMPTOM}
- **Erro:** ${ERROR_DESC}
- **Diagnóstico:** (preencher)

### Correção
${FIX}

### Testes adicionados
(descrever)

### Lição
(registrar aprendizado reutilizável)
`;

// Append to learned cases
fs.appendFileSync(LEARNED_FILE, caseEntry);
console.log(`📖 Caso #${caseNum} registrado em ayoa-learned-cases.md`);

// Add to pitfalls if applicable
if (ARGS.addPitfall) {
  const pitfallEntry = `
### ${CASE_NAME}
- **Sintoma:** ${SYMPTOM}
- **Causa:** (diagnóstico)
- **Fix:** ${FIX}
`;
  fs.appendFileSync(PITFALLS_FILE, pitfallEntry);
  console.log(`⚠️  Pitfall registrado em pitfalls.md`);
}

// If test-create, create a test stub
if (TEST_CREATE) {
  const testStub = `
// Test: ${CASE_NAME}
// Data: ${date}
// Este teste valida a correção do Caso #${caseNum}

const { strict: assert } = require('node:assert');

async function test_${CASE_NAME.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}() {
  // TODO: implementar teste
  console.log('Teste #${caseNum} — ${CASE_NAME}: PENDENTE');
}

module.exports = { test_${CASE_NAME.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()} };
`;
  const testFile = path.join(SKILL_DIR, 'scripts', `test-case-${String(caseNum).padStart(3, '0')}.js`);
  fs.writeFileSync(testFile, testStub);
  console.log(`🧪 Test stub criado: ${testFile}`);
}

// Update version in SKILL.md
let skillContent = fs.readFileSync(SKILL_MD, 'utf-8');
skillContent = skillContent.replace(
  /version: (\d+\.\d+\.\d+)/,
  `version: ${newVersion}`
);
const changelogDate = date;
if (skillContent.includes(`- "${newVersion}`)) {
  // Already updated
} else {
  // Add changelog entry
  const changelogInsert = `  - "${newVersion} (${changelogDate}): Caso #${caseNum} — ${CASE_NAME}.`;
  skillContent = skillContent.replace(
    /changelog:\n/,
    `changelog:\n${changelogInsert}\n`
  );
}
fs.writeFileSync(SKILL_MD, skillContent);
console.log(`📦 Version bumped to ${newVersion} in SKILL.md`);

console.log(`\n✅ Ciclo adaptativo completo.`);
console.log(`   Próximo passo: implementar a correção nos scripts e rodar ayoa-test-suite.js`);
