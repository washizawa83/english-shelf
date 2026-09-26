# English Shelf plugin

The plugin uses the same local SQLite database as the desktop app. No OpenAI API key is stored in the app.

Shortest curriculum workflow in Codex:

1. Ask: 「今ある英文・文法から、学習カリキュラムを提案して」
2. Review the proposed units, order, goals, and relations.
3. Ask: 「この案をEnglish Shelfに保存して」

Codex reads the current curriculum and grammar items through MCP, then creates units and relations only after the plan is accepted.
