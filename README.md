# KUMA Module — Examens CEPE/BEPC (Côte d'Ivoire) 🇨🇮

**Version 1.0.0 · API v1 · Module Autonome**

Banque d'épreuves, bulletins blancs et prédictions de réussite aux examens nationaux CEPE/BEPC.

---

## 🏗️ Structure Atomique

```
modules/exam-cepe/
├── module.json    ✅ Manifest
├── README.md      ✅ Documentation
├── registry.json  ✅ Métadonnées hub
├── server/        ✅ Factory Hono, schema mod_exam_*
├── frontend/      ✅ Component React autonome
├── scripts/       ✅ CLI + ZIP
└── .github/     ✅ CI/CD Release
```

## 📦 Installation

```bash
npx wrangler d1 execute <DB> --remote --file modules/exam-cepe/server/schema.sql
# Mount : app.route('/api/v1/modules/exam', createExamModule());
```

## 🔌 API v1

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | Probe de capacité |
| POST | `/question` | Ajouter une question |
| GET | `/questions` | Rechercher des questions |
| POST | `/result` | Enregistrer un résultat |
| GET | `/statistics/:classId` | Statistiques classe |
| GET | `/prediction/:studentId` | Prédiction réussite |
| POST | `/compute-predictions` | Calculer prédictions |

## 📄 License
MIT — Libre utilisation dans vos écoles KSP.