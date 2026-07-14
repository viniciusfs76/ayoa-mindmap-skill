# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.6.x   | :white_check_mark: |
| < 1.6.0 | :x:                |

## Reporting a Vulnerability

Por favor, **não** abra uma issue pública para vulnerabilidades de segurança. Envie um e-mail para **viniciusfs76@gmail.com** com:

- Descrição da vulnerabilidade
- Passos para reproduzir
- Impacto potencial

Você receberá uma resposta em até 72 horas. Vamos trabalhar juntos em uma correção antes de qualquer divulgação pública.

## Cookies e credenciais

- **Nunca** commitar cookies, tokens ou credenciais.
- Capture via clipboard do Termux (skill `sensitive-credential-handling`) e armazene em `~/tmp/` (efêmero).
- Use `shred -u <arquivo>` após uso.
- O `.gitignore` da skill já exclui `*.cookies.json` e `*.token.txt`.
