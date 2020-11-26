const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const watcher = chokidar.watch('.');
const trees = {};
const sources = {};

watcher.on('change', (rePath) => {
    const filePath = path.join(process.cwd(), rePath);
    const parent = path.dirname(filePath);

    if (!trees[parent]) {
        trees[parent] = fs.readdirSync(parent).map(name => path.join(parent, name));

        for (const file of trees[parent]) {
            const ext = path.extname(file);
            const alt = ext === 'js' ? 'css' : 'js';
            const altPath = file.slice(0, -ext.length) + alt;

            if (fs.existsSync(altPath)) {
                sources[file] = altPath;
            }
        }
    }

    const siblings = trees[parent];
    const ext = path.extname(filePath);

    console.log(filePath, sources[filePath]);
});