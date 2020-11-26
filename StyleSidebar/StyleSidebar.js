(function() {
    if (window.StyleSidebar) {
        window.StyleSidebar.cleanup();
    }

    window.StyleSidebar = {
        cleanup: function() {
            this.style.remove();
            this.sidebar.remove();
        },
        init: function() {
            this.hljs = window.dev.highlight;

            this.hljs.loadLanguage('css');

            this.WHITESPACE = [9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279];

            this.wrapper = this.getSiteWrapper();
            this.style = this.createStyle();
            this.sidebar = this.createSidebar();

            this.openBraces = 0;
            this.lastCursor = 0;

            this.closeSidebar();
            this.resize(this.getWidth());

            this.animations = true;
        },
        getSiteWrapper: function() {
            return document.querySelector('.WikiaSiteWrapper');
        },
        getWidth: function() {
            return 320;
        },
        createStyle: function() {
            var style = document.createElement('style');
            style.type = 'text/css';
            style.id = 'style-element';

            document.head.appendChild(style);

            return style;
        },
        createSidebar: function() {
            var sidebar = document.createElement('div');
            sidebar.id = 'style-sidebar';

            sidebar.appendChild(this.createArrow());
            sidebar.appendChild(this.createContainer());

            document.body.appendChild(sidebar);

            return sidebar;
        },
        createArrow: function() {
            var arrow = document.createElement('div');
            this.arrow = arrow;
            arrow.id = 'style-arrow';

            arrow.addEventListener('click', this.toggleSidebar.bind(this));

            return arrow;
        },
        createContainer: function() {
            var container = document.createElement('div');
            container.id = 'style-container';

            container.appendChild(this.createHeader());
            container.appendChild(this.createBody());

            return container;
        },
        createHeader: function() {
            var header = document.createElement('div');
            header.id = 'style-header';

            header.appendChild(this.createSelector());

            return header;
        },
        createSelector: function() {
            var selector = document.createElement('div');
            selector.id = 'style-selector';

            var img = document.createElement('img');
            img.width = 24;
            img.height = 24;
            img.src = 'https://cdn.discordapp.com/attachments/505815497598828570/685494859104124938/Pick.png';

            selector.appendChild(img);

            selector.addEventListener('click', this.onElementSelectorClick.bind(this));

            return selector;
        },
        createBody: function() {
            var body = document.createElement('div');
            body.id = 'style-body';

            var highlight = document.createElement('pre');
            this.highlight = highlight;
            highlight.id = 'style-highlight';

            body.appendChild(highlight);
            body.appendChild(this.createTextarea());

            return body;
        },
        createTextarea: function() {
            var textarea = document.createElement('textarea');
            this.textarea = textarea;
            textarea.id = 'style-textarea';

            textarea.addEventListener('keydown', this.onKeyDown.bind(this));
            textarea.addEventListener('input', this.onWrite.bind(this));

            return textarea;
        },
        resize: function(width) {
            this.sidebar.style.width = width + 'px';

            this.updateSidebarPosition();
        },
        toggleSidebar: function() {
            if (this.isOpen) {
                this.closeSidebar();
            } else {
                this.openSidebar();
            }
        },
        openSidebar: function() {
            this.isOpen = true;
            this.arrow.textContent = '»';
            this.updateSidebarPosition();

            document.body.classList.add('style-sidebar-open');
        },
        closeSidebar: function() {
            this.isOpen = false;
            this.arrow.textContent = '«';
            this.updateSidebarPosition();

            document.body.classList.remove('style-sidebar-open');
        },
        updateSidebarPosition: function() {
            var shiftRight = 0;

            if (!this.isOpen) {
                shiftRight = this.getWidth() - this.arrow.scrollWidth;
            }

            this.sidebar.style.transform = 'translateX(' + shiftRight + 'px)';

            if (!this.animations) {
                this.skipAnimations(this.sidebar);
            }
        },
        skipAnimations: function(elem) {
            var previous = elem.style.transition;
            elem.style.transition = 'none';
            elem.scrollHeight;
            elem.style.transition = previous;
        },
        updateBraceCount: function() {
            var textarea = this.textarea;
            var value = textarea.value;

            if (textarea.selectionStart !== textarea.selectionEnd) {
                this.openBraces = 0;
                return;
            }

            // var i = Math.min(this.lastCursor, textarea.selectionEnd);
            // var end = Math.max(this.lastCursor, textarea.selectionEnd);
            var i = 0;
            var end = textarea.selectionEnd;

            this.openBraces = 0;

            while (i < end) {
                var char = value.charAt(i);

                switch (char) {
                    case '{':
                        this.openBraces++;
                        break;
                    case '}':
                        this.openBraces--;
                        break;
                }

                i++;
            }

            this.lastCursor = end;
        },
        insertText: function(input, text) {
            var value = input.value;
            var start = input.selectionStart;
            input.value = value.slice(0, start) + text + value.slice(input.selectionEnd);
            input.selectionEnd = start + text.length;

            this.updateHighlight();
        },
        isWhitespace: function(charCode) {
            return this.WHITESPACE.includes(charCode);
        },
        doWordDelete: function(input, direction) {
            var value = input.value;
            var start = input.selectionStart;
            var end = input.selectionEnd;
            var ws = false;
            var i = 0;

            switch (direction) {
                case 'forwards':
                    ws = this.isWhitespace(value.charCodeAt(end + 1));

                    for (i = end + 1; i < value.length; i++) {
                        if (this.isWhitespace(value.charCodeAt(i)) !== ws) break;
                    }

                    end = i;
                    break;
                case 'backwards':
                    ws = this.isWhitespace(value.charCodeAt(start - 1));
                    i = start - 1;

                    if (i > 0) {
                        while (i--) {
                            if (this.isWhitespace(value.charCodeAt(i)) !== ws) break;
                        }

                        start = i + 1;
                    }
                    break;
            }

            // console.log(`
            //     Value: ${value}
            //     Range: ${start}-${end}
            //     Slice: ${value.slice(start, end)}
            //     Whitespace: ${ws}
            //     Direction: ${direction}
            // `);

            input.value = value.slice(0, start) + value.slice(end);
            input.selectionStart = start;
            input.selectionEnd = start;

            this.updateHighlight();
        },
        indentSelected: function(textarea, invert) {
            var value = textarea.value;
            var start = textarea.selectionStart;
            var end = textarea.selectionEnd;

            var i = start;
            while (i--) {
                if (value.charAt(i) === '\n') break;
            }

            var startdiff = start - i;

            start = i + 1;

            for (i = end; i < value.length; i++) {
                if (value.charAt(i) === '\n') break;
            }

            var enddiff = i - end;

            end = i;

            var slice = value.slice(start, end);

            if (invert) {
                var replaced = false;
                slice = slice.replace(/^\t| {4}/gm, function(full) {
                    if (!replaced) {
                        replaced = true;
                        startdiff = Math.max(0, startdiff - full.length * 2);
                    }
                    return '';
                });

                if (!replaced) {
                    startdiff -= 1;
                }
            } else {
                slice = slice.replace(/^/gm, '\t');
            }

            // console.log(`
            //     Range: ${start}-${end}
            //     Invert: ${invert}
            //     Start diff: ${startdiff}
            //     End diff: ${enddiff}
            // `);

            textarea.value = value.slice(0, start) + slice + value.slice(end);
            textarea.selectionStart = start + startdiff;
            textarea.selectionEnd = start + slice.length - enddiff;
            this.updateHighlight();
        },
        onKeyDown: function(event) {
            var textarea = this.textarea;
            this.updateBraceCount();

            switch (event.keyCode) {
                case 9: // Tab
                    event.preventDefault();
                    if (textarea.selectionStart === textarea.selectionEnd && !event.shiftKey) {
                        this.insertText(textarea, '\t');
                    } else {
                        this.indentSelected(textarea, event.shiftKey);
                    }
                    break;
                case 8: // Backspace
                case 46: // Delete
                    if (event.ctrlKey) {
                        event.preventDefault();
                        var mode = event.keyCode === 8 ? 'backwards' : 'forwards';
                        this.doWordDelete(textarea, mode);
                    }
                    break;
                case 13: // Enter
                    if (this.openBraces > 0) {
                        event.preventDefault();
                        this.insertText(textarea, '\n' + new Array(this.openBraces + 1).join('\t'));
                    }
                    break;
                case 191: // Closing curly braces
                    if (textarea.value.charAt(textarea.selectionEnd - 1) === '\t') {
                        textarea.value = textarea.value.slice(0, textarea.selectionEnd - 1) + textarea.value.slice(textarea.selectionStart);
                    }
                    break;
            }
        },
        onWrite: function(event) {
            this.updateHighlight();
        },
        onElementSelectorClick: function() {

        },
        updateHighlight: function() {
            var textarea = this.textarea;
            var css = textarea.value;


            this.style.textContent = css;
            var result = this.hljs.highlight('css', css, true);
            this.highlight.innerHTML = result.value;
        }
    };

    mw.hook('dev.highlight').add(function() {
        window.StyleSidebar.init();
    });

    importArticle({
        type: 'script',
        article: 'u:dev:MediaWiki:Highlight-js.js'
    });
})();