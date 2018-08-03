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
        highlightRegexp: /```([\s\S]*)```/g,
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
                this.performReplacements(message);
            }
        },
        performReplacements: function(message) {            
            message.innerHTML = message.innerHTML.replace(this.highlightRegexp, this.replaceFunction.bind(this));
        },
        replaceFunction: function(_, capt1) {
            var lines = capt1.split('\n'),
            language = 'nohighlight hljs',
            _lang = lines[0];

            if (this.aliases[_lang]) _lang = this.aliases[_lang];
            if (lines.length > 1 && this.languages.indexOf(_lang.toLowerCase()) != -1) language = lines.shift().toLowerCase();

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
        init: function() {
            if (!define.amd) {
                define.amd = amd;
            }
            this.languages = hljs.listLanguages();
            this.bindToAllMessages(this.afterMessage.bind(this));
        }
    }, window.ChatSyntaxHighlight);

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