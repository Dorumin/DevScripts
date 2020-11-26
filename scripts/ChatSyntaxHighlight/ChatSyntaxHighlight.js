/* ChatSyntaxHighlight
 *
 * Introduces syntax highlighting into chat using markup syntax
 * Depends on highlight.js for language support
 * 
 * @author Dorumin
 */

(function() {
    if (
        mw.config.get('wgCanonicalSpecialPageName') != 'Chat' ||
        (window.ChatSyntaxHighlight && window.ChatSyntaxHighlight.init)
    ) return;

    var amd = define.amd,
    ChatSyntaxHighlight = $.extend({
        mobile: true,
        index: 0,
        highlightRegexp: /```([\s\S]*?)```/g,
        languages: [],
        theme: 'default',
        aliases: {
            js: 'javascript',
            //java: 'javascript',
            'c++': 'cpp',
            cplusplus: 'cpp',
            'objective-c': 'objectivec'
        },
        extraLanguages: [],
        _preload: 0,
        _loadedLanguages: 0,
        preload: function() {
            if (++this._preload == 2) {
                if (!this.extraLanguages.length) {
                    this.init();
                } else {
                    this.extraLanguages.forEach(function(lang) {
                        importScriptURI('https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/languages/' + lang + '.min.js')
                            .onload = ChatSyntaxHighlight.preloadLang.bind(ChatSyntaxHighlight);
                    });
                }
            }
        },
        preloadLang: function() {
            if (++this._loadedLanguages == this.extraLanguages.length) {
                this.init();
            }
        },
        bindToAllMessages: function(fn) {
            mainRoom.model.chats.models.forEach(fn);
            mainRoom.model.chats.bind('afteradd', fn);
            mainRoom.model.privateUsers.bind('add', function(user) {
                var privateRoom = mainRoom.chats.privates[user.attributes.roomId];
                privateRoom.model.chats.bind('afteradd', fn);
            });
        },
        afterMessage: function(model) {
            var message = document.querySelector('#entry-' + model.cid + ' .message');

            if (message && this.highlightRegexp.test(message.innerHTML)) {
                this.performReplacements(message, model);
            }
        },
        performReplacements: function(message, model) {
            this.index = 0;
            var matches = model.attributes.text.match(this.highlightRegexp).map(function(str) {
                return str.slice(3, -3);
            });
            message.innerHTML = message.innerHTML.replace(this.highlightRegexp, this.replaceFunction.bind(this, matches));
        },
        replaceFunction: function(matches) {
            var lines = matches[this.index++].split('\n'),
            language = 'nohighlight hljs',
            _lang = lines[0].toLowerCase();

            if (this.aliases[_lang]) _lang = this.aliases[_lang];
            if (lines.length > 1 && this.languages.indexOf(_lang) != -1) {
                lines.shift();
                language = _lang;
            }

            var pre = document.createElement('pre');
            var code = document.createElement('code');
            pre.className = 'hljs-pre';
            code.className = language;
            code.textContent = lines.join('\n');
            if (language !== 'nohighlight hljs') {
                pre.setAttribute('data-lang', language);
            }

            pre.appendChild(code);
            hljs.highlightBlock(code);

            return pre.outerHTML;
        },
        onInput: function(e) {
            var matches = e.target.value.match(/```[\s\S]*?(```|$)/g),
            isWritingCodeBlock = matches && matches[matches.length - 1].slice(-3) != '```';
            if (!isWritingCodeBlock) mainRoom.sendMessage(e);
        },
        init: function() {
            if (!define.amd && amd) {
                define.amd = amd;
            }
            this.languages = hljs.listLanguages();
            this.bindToAllMessages(this.afterMessage.bind(this));
        }
    }, window.ChatSyntaxHighlight);

    // Take over input handling
    mainRoom.viewDiscussion
        .unbind('sendMessage')
        .bind('sendMessage', ChatSyntaxHighlight.onInput);

    window.ChatSyntaxHighlight = ChatSyntaxHighlight;

    importArticle({
        type: 'script',
        article: 'u:dev:MediaWiki:Chat-js.js'
    });

    importArticle({
        type: 'style',
        article: 'u:dev:MediaWiki:ChatSyntaxHighlight.css'
    });

    define.amd = null;
    importScriptURI('https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/highlight.min.js')
        .onload = ChatSyntaxHighlight.preload.bind(ChatSyntaxHighlight);

    if (ChatSyntaxHighlight.theme) {
        importStylesheetURI('https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/styles/' + ChatSyntaxHighlight.theme + '.min.css');
    }

    mw.hook('dev.chat.render').add(ChatSyntaxHighlight.preload.bind(ChatSyntaxHighlight));
})();
