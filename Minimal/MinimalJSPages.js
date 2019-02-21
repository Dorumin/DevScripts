(function() {
    if (mw.config.get('wgCanonicalSpecialPageName') !== 'JSPages') return;
    mw.hook('dev.i18n').add(function(lib) {
        lib.loadMessages('MinimalJSPages').done(function(i18n) {
            var button = document.createElement('button'),
            parent = document.querySelector('.content-review-module-test-mode-enable, #mw-content-text .content-review-module-test-mode-disable').parentElement;
            button.className = 'showunsubmitted secondary';
            button.textContent = i18n.msg('show').plain();
            button.onclick = function() {
                parent.removeChild(button);
                document.querySelectorAll('tr:not(.content-review-special-list-headers)').forEach(function(row) {
                    if (row.querySelector('.content-review-module-submit')) return;
                    row.style.display = 'none';
                });
            };
            parent.appendChild(button);
            document.querySelectorAll('.content-review-status').forEach(function(status) {
                var td = status.parentElement,
                nodes = td.childNodes,
                i = nodes.length;
                while (i--) {
                    var node = nodes[i];
                    if (
                        node.nodeType == Node.TEXT_NODE ||
                        status.classList.contains('content-review-status-rejected') && i == 1
                    ) {
                        td.removeChild(node);
                    }
                }
            });
        });
    });

    importArticle({
        type: 'script',
        article: 'u:dev:MediaWiki:I18n-js/code.js'
    }, {
        type: 'style',
        article: 'u:dev:MediaWiki:MinimalJSPages.css'
    });
})();