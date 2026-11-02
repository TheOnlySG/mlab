# PracticalHub

A static portal for the ten machine-learning lab notebooks in this repository. It provides fast full-text search across notebook cells, readable code and saved outputs, one-click code copying, notebook downloads, progress tracking, and a distraction-free Quick Mode.

No build step is required. The site is plain HTML, CSS, and vanilla JavaScript, with Prism.js, Fuse.js, and JSZip loaded from CDN.

## Features

- Full-text search across all practicals and notebook cells
- Exact code cells with syntax highlighting and saved outputs
- Copy individual cells or all code from a practical
- Download the original `.ipynb` file or practical code as `.py`
- Mark practicals complete; progress is stored in `localStorage`
- Recently opened practicals
- Per-practical table of contents and scrollspy
- Deep links to individual cells
- Quick Mode for a compact, copy-focused view
- Download all ten notebooks as a ZIP
- Responsive layout with an off-canvas sidebar on mobile
- Print-friendly styles

## Pages

- `index.html` - dashboard with stats, progress, recent practicals, and the full index
- `practical.html?p=N` - individual practical, for example `practical.html?p=8`
- `practical.html?p=N&cell=M#cell-M` - deep link to a specific cell

## Project Structure

```text
.
├── index.html
├── practical.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── practical.js
│   ├── search.js
│   └── utils.js
├── data/
│   ├── practicals.json
│   ├── practical-01.json ... practical-10.json
│   └── search-index.json
├── notebooks/
│   └── lab1.ipynb ... lab10.ipynb
├── assets/
│   └── favicon.svg
└── README.md
```

The notebooks at the repository root are the original files. The copies in `notebooks/` are used for downloads so the portal can keep stable links without depending on the root filenames.

`data/` contains derived, pre-generated JSON. The browser never parses `.ipynb` files at runtime.

## Run Locally

Serve the repository root with any static web server:

```bash
python3 -m http.server 8000
```

Then open <http://127.0.0.1:8000/>.

Opening `index.html` directly from the filesystem will not work because the browser cannot fetch the JSON data files over `file://`.

## Deploy

The site is ready for GitHub Pages. Publish the repository root from the branch you use for Pages; no build or `dist/` directory is needed.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `/` or `Ctrl+K` / `Cmd+K` | Open search |
| `Esc` | Clear the query, then close search |
| `ArrowDown` / `ArrowUp` | Move through search results |
| `Enter` | Open the selected search result |
| `Ctrl+Shift+C` / `Cmd+Shift+C` | Copy all code on a practical page |
| `Alt+Left` / `Alt+Right` | Previous or next practical |
| `Q` | Toggle Quick Mode |
| `?` | Show keyboard shortcuts |

## Practical Index

| # | Notebook | Title |
| --- | --- | --- |
| 01 | `lab1.ipynb` | Data Preprocessing Pipeline with the Titanic Dataset |
| 02 | `lab2.ipynb` | PCA vs LDA with Logistic Regression on Diabetes Prediction Data |
| 03 | `lab3.ipynb` | Linear Regression on the scikit-learn Diabetes Dataset |
| 04 | `lab4.ipynb` | Polynomial Regression and Model Complexity on California Housing |
| 05 | `lab5.ipynb` | Linear, Ridge and Lasso Regression Comparison on Diabetes Data |
| 06 | `lab6.ipynb` | Logistic Regression and Classification Metrics on Diabetes Prediction Data |
| 07 | `lab7.ipynb` | Linear vs RBF SVM on the Pima Indians Diabetes Dataset |
| 08 | `lab8.ipynb` | K-Means Clustering with Elbow Method and Silhouette Score |
| 09 | `lab9.ipynb` | DBSCAN Clustering and Outlier Detection on Mall Customers |
| 10 | `lab10.ipynb` | Ensemble Classifier Comparison on Pima Indians Diabetes Data |

Titles, aims, topic labels, and library summaries are study-guide metadata derived from the notebooks. The notebook cells and saved outputs remain the source of truth.

## Notes

- Code and markdown are preserved exactly, including whitespace and blank code cells.
- Saved pandas tables are sanitized before being rendered.
- Search and ZIP downloads use CDN libraries, so the first load needs network access.
- Progress, recent items, and Quick Mode preference are stored locally in the browser.
