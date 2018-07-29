(function() {
    window.dev = window.dev || {};

    // Double runs
    if (window.dev.i18n !== undefined) {
        return;
    }

    /* Main library class, only one should be instantiated. */
    class Main {
        constructor() {
            this.cache = {};
            this.overrides = {};
        }

        /* Removes comments from a JSON string.
         * Also only removes inline (//) comments from the beginning of the string, and only until it finds an html tag inside.
         * 
         * @param {string} jsonString JSON string.
         */
        removeComments(jsonString) {
            return jsonString.replace(/(".+")|\/\*.+\*\/|^\/\/\s*<.+?>/g, (fullMatch, group1) => {
                if (group1) { // Oops, we found a string. Don't remove comments there.
                    return fullMatch;
                }
                return '';
            });
        }

        /* Parses JSON into an object, ignoring comments.
         *
         * @param {string} jsonString JSON string.
         */
        parseJSON(jsonString) {
            try {
                return JSON.parse(this.removeComments(jsonString));
            } catch(e) {
                let msg = e.message;

                if (e.message == 'Unexpected end of JSON input') msg += '. This may have been caused by a non-existent i18n.json page.';

                mw.log(`[I18n-js] SyntaxError in messages: ${msg}`);

                return null;
            }
        }

        /* Gets the correct import page for importArticles.
         *
         * @param {string} page Script name or importArticle string.
         */
        getScriptPath(page) {
            if (page.startsWith('u:')) return page;
            return `u:dev:MediaWiki:Custom-${page}/i18n.json`;
        }

        /* Returns load.php url for a specific page.
         *
         * @param {string} part importArticle string for page to load from.
         */
        getImportUrl(part) {
            return mw.util.wikiScript('load') + '?' + $.param({
                mode: 'articles',
                articles: part,
                only: 'styles',
                // Hell yeah, minification!
                // debug: '1'
            });
        }

        /* Loads messages from a json page
         * 
         * @param {string} script Dev script name to load i18n messages from, or importArticles-compliant string.
         * @returns {Deferred<I18n>} Promise that resolves in an i18n instance.
         */
        loadMessages(script) {
            return $.Deferred(def => {
                let page = this.getScriptPath(script),
                scriptName = script.includes('u:') ? null : script;
                if (this.cache[page]) {
                    return def.resolve(new I18n(json, this.overrides, scriptName));
                }
                $.get(this.getImportUrl(page))
                    .then(text => this.parseJSON(text))
                    .then(obj => {
                        if (obj === null) {
                            def.reject();
                        } else {
                            this.cache[page] = json;
                            def.resolve(new I18n(json, this.overrides, scriptName));
                        }
                    })
                    .fail(def.reject);
            });
        }

        /* Return I18n instance from object. Only use for debugging, or when loadMessages cannot be used.
         *
         * @param {Object} obj I18n compliant object.
         * @returns {I18n} I18n object holding the provided messages.
         */
        fromJSON(object) {
            return new I18n(object, this.overrides, null);
        }
    }

    /* Represents a single i18n instance */
    class I18n {
        constructor(messages, overrides, name) {
            this.language = 'en';
            this.tempLang = null;
            this.cfg = mw.config.get([
                'wgUserLanguage',
                'wgContentLanguage'
            ]);
            this._preprocess = [];
            this._postprocess = [];
            this.name = name;
            this.messages = messages;
            this.overrides = overrides;
            this.fallbacks = {
                'ab': 'ru',
                'ace': 'id',
                'aln': 'sq',
                'als': 'gsw',
                'an': 'es',
                'anp': 'hi',
                'arn': 'es',
                'arz': 'ar',
                'av': 'ru',
                'ay': 'es',
                'ba': 'ru',
                'bar': 'de',
                'bat-smg': 'sgs',
                'bcc': 'fa',
                'be-x-old': 'be-tarask',
                'bh': 'bho',
                'bjn': 'id',
                'bm': 'fr',
                'bpy': 'bn',
                'bqi': 'fa',
                'bug': 'id',
                'cbk-zam': 'es',
                'ce': 'ru',
                'ckb': 'ckb-arab',
                'crh': 'crh-latn',
                'crh-cyrl': 'ru',
                'csb': 'pl',
                'cv': 'ru',
                'de-at': 'de',
                'de-ch': 'de',
                'de-formal': 'de',
                'dsb': 'de',
                'dtp': 'ms',
                'eml': 'it',
                'ff': 'fr',
                'fiu-vro': 'vro',
                'frc': 'fr',
                'frp': 'fr',
                'frr': 'de',
                'fur': 'it',
                'gag': 'tr',
                'gan': 'gan-hant',
                'gan-hans': 'zh-hans',
                'gan-hant': 'zh-hant',
                'gl': 'pt',
                'glk': 'fa',
                'gn': 'es',
                'gsw': 'de',
                'hif': 'hif-latn',
                'hsb': 'de',
                'ht': 'fr',
                'ii': 'zh-cn',
                'inh': 'ru',
                'iu': 'ike-cans',
                'jut': 'da',
                'jv': 'id',
                'kaa': 'kk-latn',
                'kbd': 'kbd-cyrl',
                'kbd-cyrl': 'ru',
                'khw': 'ur',
                'kiu': 'tr',
                'kk': 'kk-cyrl',
                'kk-arab': 'kk-cyrl',
                'kk-cn': 'kk-arab',
                'kk-kz': 'kk-cyrl',
                'kk-latn': 'kk-cyrl',
                'kk-tr': 'kk-latn',
                'kl': 'da',
                'koi': 'ru',
                'ko-kp': 'ko',
                'krc': 'ru',
                'ks': 'ks-arab',
                'ksh': 'de',
                'ku': 'ku-latn',
                'ku-arab': 'ckb',
                'kv': 'ru',
                'lad': 'es',
                'lb': 'de',
                'lbe': 'ru',
                'lez': 'ru',
                'li': 'nl',
                'lij': 'it',
                'liv': 'et',
                'lmo': 'it',
                'ln': 'fr',
                'ltg': 'lv',
                'lzz': 'tr',
                'mai': 'hi',
                'map-bms': 'jv',
                'mg': 'fr',
                'mhr': 'ru',
                'min': 'id',
                'mo': 'ro',
                'mrj': 'ru',
                'mwl': 'pt',
                'myv': 'ru',
                'mzn': 'fa',
                'nah': 'es',
                'nap': 'it',
                'nds': 'de',
                'nds-nl': 'nl',
                'nl-informal': 'nl',
                'no': 'nb',
                'os': 'ru',
                'pcd': 'fr',
                'pdc': 'de',
                'pdt': 'de',
                'pfl': 'de',
                'pms': 'it',
                // 'pt': 'pt-br',
                'pt-br': 'pt',
                'qu': 'es',
                'qug': 'qu',
                'rgn': 'it',
                'rmy': 'ro',
                'rue': 'uk',
                'ruq': 'ruq-latn',
                'ruq-cyrl': 'mk',
                'ruq-latn': 'ro',
                'sa': 'hi',
                'sah': 'ru',
                'scn': 'it',
                'sg': 'fr',
                'sgs': 'lt',
                'shi': 'ar',
                'simple': 'en',
                'sli': 'de',
                'sr': 'sr-ec',
                'srn': 'nl',
                'stq': 'de',
                'su': 'id',
                'szl': 'pl',
                'tcy': 'kn',
                'tg': 'tg-cyrl',
                'tt': 'tt-cyrl',
                'tt-cyrl': 'ru',
                'ty': 'fr',
                'udm': 'ru',
                'ug': 'ug-arab',
                'uk': 'ru',
                'vec': 'it',
                'vep': 'et',
                'vls': 'nl',
                'vmf': 'de',
                'vot': 'fi',
                'vro': 'et',
                'wa': 'fr',
                'wo': 'fr',
                'wuu': 'zh-hans',
                'xal': 'ru',
                'xmf': 'ka',
                'yi': 'he',
                'za': 'zh-hans',
                'zea': 'nl',
                'zh': 'zh-hans',
                'zh-classical': 'lzh',
                'zh-cn': 'zh-hans',
                'zh-hant': 'zh-hans',
                'zh-hk': 'zh-hant',
                'zh-min-nan': 'nan',
                'zh-mo':  'zh-hk',
                'zh-my':  'zh-sg',
                'zh-sg':  'zh-hans',
                'zh-tw':  'zh-hant',
                'zh-yue': 'yue'
            };
        }

        useLang(lang) {
            this.language = lang;
            return this;
        }

        useUserLang() {
            return this.useLang(this.cfg.wgUserLanguage);
        }

        useContentLang() {
            return this.useLang(this.cfg.wgContentLanguage);
        }

        inLang(lang) {
            this.tempLang = lang;
            return this;
        }

        inUserLang() {
            return this.inLang(this.cfg.wgUserLanguage);
        }

        inContentLang() {
            return this.inLang(this.cfg.wgContentLanguage);
        }

        preprocess(fn) {
            this._preprocess.push(fn);
        }
        
        postprocess(fn) {
            this._postprocess.push(fn);
        }

        msg(key, ...args) {
            let message = this._getMsg(key, this.tempLang ? this.tempLang : this.lang);

            this.preprocess.forEach(fn => message = fn(key, message));
            
            message = message.replace(/\$(\d)/g, (fullMatch, index) => {
                if (args[index - 1]) return args[index - 1];
                return fullMatch;
            });

            this.postprocess.forEach(fn => message = fn(key, message));
            
            if (this.tempLang) this.tempLang = null;
            
            return new Message(key, message);
        }

        _getMsg(key, lang) {
            let {
                name,
                messages,
                overrides
            } = this;

            if (overrides[name] && overrides[name][key]) return overrides[name][key]
            else if (messages[lang] && messages[lang][key]) return messages[lang][key];
            else if (lang == 'en') return `<${key}>`;

            return this._getMsg(key, this.fallbacks[lang] || 'en');
        }
    }
    

    /* Represents a single i18n message. */
    class Message {

        /* Create a new message.
         *
         * @param {string} key Message key
         * @param {string} text Message text, with variables substituted.
         */
        constructor(key, text) {
            this.key = key;
            this.text = text;
        }

        /* Get the message content without any processing. */
        plain() {
            return this.text;
        }

        /* Get the message content HTML escaped. */
        escape() {
            return mw.html.escape(this.text);
        }

        /* Get the message content with wikitext links parsed. */
        parse() {
            if (this.isMissing()) return this.escape();

            return this._parse(this.text);
        }

        /* Get the message content with markdown links parsed. */
        markdown() {
            if (this.isMissing()) return this.escape();

            return this._markdown(this.text);
        }

        /* Check if the message is in a not found state (<key>) */
        isMissing() {
            return this.text == `<${this.key}>`;
        }

        _markdown(message) {
            // [text](url)
            var urlRgx = /\[(.+?)\]\(((?:https?:)?\/\/.+?)\)/g,
            // [page]
            simplePageRgx = /\[(.+?)\]/g,
            // [text](page)
            pageWithTextRgx = /\[(.+?)\]\((.+?)\)/g;

            if (message.indexOf('<') > -1) {
                message = sanitiseHtml(message);
            }

            return message
                .replace(urlRgx, (_match, text, href) => {
                    return this._makeLink(href, text);
                })
                .replace(simplePageRgx, (_match, href) => {
                    return this._makeLink(href);
                })
                .replace(pageWithTextRgx, (_match, text, href) => {
                    return this._makeLink(href, text);
                });
        }

        _parse(message) {
            let urlRgx = /\[((?:https?:)?\/\/.+?) (.+?)\]/g,
            // [[pagename]] -> [[$1]]
            simplePageRgx = /\[\[([^|]*?)\]\]/g,
            // [[pagename|text]] -> [[$1|$2]]
            pageWithTextRgx = /\[\[(.+?)\|(.+?)\]\]/g;
 
            if (message.indexOf('<') > -1) {
                message = this._sanitize(message);
            }
    
            return message
                .replace(urlRgx, (_match, href, text) => {
                    return this._makeLink(href, text);
                })
                .replace(simplePageRgx, (_match, href) => {
                    return this._makeLink(href);
                })
                .replace(pageWithTextRgx, (_match, href, text) => {
                    return this._makeLink(href, text);
            });
        }

        _makeLink(_href, text) {
            let hasProtocol = (_href.indexOf('http') === 0 || _href.indexOf('//') === 0);
     
            text = text || _href;
            let href = hasProtocol ? _href : mw.util.getUrl(_href);
     
            text = mw.html.escape(text);
            href = mw.html.escape(href);
     
            return '<a href="' + href + '" title="' + _href + '">' + text + '</a>';
        }

        _sanitize(html) {
            var $html = $.parseHTML(html, /* document */ null, /* keepscripts */ false),
            $div = $('<div>').append($html),
            whitelistAttrs = [
                'title',
                'style',
                'class'
            ],
            whitelistTags = [
                'i',
                'b',
                'em',
                'strong',
                'span'
            ];
 
            $div.find('*').each(function() {
                var $this = $(this),
                    tagname = $this.prop('tagName').toLowerCase(),
                    attrs,
                    array,
                    style;
    
                if (whitelistTags.indexOf(tagname) === -1) {
                    mw.log('[I18n-js] Disallowed tag in message: ' + tagname);
                    $this.remove();
                    return;
                }
    
                attrs = $this.prop('attributes');
                array = Array.prototype.slice.call(attrs);
    
                array.forEach((attr) => {
                    if (whitelistAttrs.indexOf(attr.name) === -1) {
                        mw.log('[I18n-js] Disallowed attribute in message: ' + attr.name + ', tag: ' + tagname);
                        $this.removeAttr(attr.name);
                        return;
                    }
    
                    // make sure there's nasty in nothing in style attributes
                    if (attr.name === 'style') {
                        style = $this.attr('style');
    
                        if (style.indexOf('url(') > -1) {
                            mw.log('[I18n-js] Disallowed url() in style attribute');
                            $this.removeAttr('style');
                        }
                    }
                });
            });
    
            return $div.prop('innerHTML');
        }
    }

    window.dev.i18n = $.extend(new Main(), _.pick(window.dev.i18n, 'overrides'), {
        I18n: I18n,
        Message: Message
    });

    mw.hook('dev.i18n').fire(window.dev.i18n);
})();