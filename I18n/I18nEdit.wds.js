/* I18n-js JSON editor
 *
 * Provides a specialized internationalization editor at Special:BlankPage/I18nEdit
 *
 * @authors
    - KockaAdmiralac
    - Dorumin
*/

(function() {
    'use strict';
    // Configuration caching
    var conf = mw.config.get([
        'wgCityId',
        'wgPageName',
        'wgUserLanguage'
    ]);
    // Scope limiting
    if (
        conf.wgCityId !== '7931' ||
        conf.wgPageName.slice(0, 26).toLowerCase() !== 'special:blankpage/i18nedit' ||
        window.dev && window.dev.I18nEdit
    ) {
        return;
    }
    window.dev = window.dev || {};
    /**
     * Main object
     * @class I18nEdit
     */
    var I18nEdit = window.dev.I18nEdit = {
        // Commit to get WDS icons from
        commit: 'aaba695e',
        // Icons to get
        icons: [
            'pencil-small'
        ],
        /**
         * Handles resource loading
         * Each of the resources that are being preloaded are
         * calling this method as a callback
         */
        preload: function() {
            this.ui = window.dev.ui;
            this.api = new mw.Api();
            this.initSpinner();
            this.startLoading();
            this.initVars();
            var promises = [
                window.dev.i18n.loadMessages('I18nEdit'),
                this.preloadLanguageList(),
                this.preloadLanguages(),
                this.preloadAllpages()
            ].concat(this.preloadIcons());
            if (this.page) {
                promises.push(this.preloadI18n());
            }
            $.when.apply(this, promises).done($.proxy(this.init, this));
        },
        /**
         * Inserts the WDS spinner into the page
         */
        initSpinner: function() {
            this.ui({
                type: 'div',
                attr: {
                    id: 'I18nEditSpinner'
                },
                children: [
                    {
                        type: 'svg',
                        classes: ['wds-spinner', 'wds-spinner__block'],
                        attr: {
                            width: 78,
                            height: 78,
                            viewBox: '0 0 78 78',
                            xmlns: 'http://www.w3.org/2000/svg'
                        },
                        children: [
                            {
                                type: 'g',
                                attr: {
                                    transform: 'translate(39, 39)'
                                },
                                children: [
                                    {
                                        type: 'circle',
                                        classes: ['wds-spinner__stroke'],
                                        attr: {
                                            fill: 'none',
                                            'stroke-width': 2,
                                            'stroke-dasharray': 239,
                                            'stroke-dashoffset': 239,
                                            'stroke-linecap': 'round',
                                            r: 38
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                ],
                parent: 'body'
            });
        },
        /**
         * Starts showing the spinner
         */
        startLoading: function() {
            $('body').addClass('I18nEditLoading');
        },
        /**
         * Stops showing the spinner
         */
        stopLoading: function() {
            $('body').removeClass('I18nEditLoading');
        },
        /**
         * Initializes this.page and this.lang variables
         */
        initVars: function() {
            var split = conf.wgPageName.split('/'),
                title = split[2],
                lang = split[3];
            if (title) {
                this.page = decodeURIComponent(title);
                if (lang) {
                    this.lang = decodeURIComponent(lang);
                }
            }
        },
        /**
         * Preloads i18n data for the current script
         * @returns {jQuery.Deferred} Promise to listen on
         */
        preloadI18n: function() {
            return window.dev.i18n.loadMessages(this.page);
        },
        /**
         * Preloads list of all translation JSON pages
         */
        preloadAllpages: function() {
            return this.api.get({
                action: 'query',
                list: 'allpages',
                apnamespace: 8,
                apprefix: 'Custom-',
                aplimit: 'max'
            });
        },
        /**
         * Preloads list of all supported languages on Wikia
         * @returns {$.Deferred} Promise to listen on
         */
        preloadLanguageList: function() {
            return $.get(mw.util.wikiScript('load'), {
                mode: 'articles',
                articles: 'u:dev:MediaWiki:Custom-language-code-sorting',
                only: 'styles'
            });
        },
        /**
         * Preloads list of all available languages on Wikia
         * @returns {$.Deferred} Promise to listen on
         */
        preloadLanguages: function() {
            return this.api.get({
                action: 'query',
                meta: 'siteinfo',
                siprop: 'languages'
            });
        },
        /**
         * Preloads WDS icons that aren't in the DOM already
         * @returns {Array<jQuery.Deferred>} Array of promises
         */
        preloadIcons: function() {
            return this.icons.map(function(i) {
                return $.get(
                    'https://cdn.rawgit.com/Wikia/design-system/' +
                    this.commit + '/dist/svg/wds-icons-' + i + '.svg'
                );
            }, this);
        },
        /**
         * Initializes the script
         * @param {Object} i18n I18n object returned by I18n-js
         * @param {Object} languageList List of supported languages
         * @param {Object} languages Map of all languages on Wikia
         * @param {Object} allpages List of all translation pages
         * @param {Object} i18n2 I18n object for the current script
         */
        init: function(i18n, languageList, languages, allpages, pencil, i18n2) {
            this.i18n = i18n;
            this.scriptI18n = i18n2;
            this.initLanguages(languageList[0], languages[0]);
            this.initAllpages(allpages[0]);
            this.initIcons(pencil);
            this.reInit();
            this.stopLoading();
        },
        /**
         * Initializes a map of supported languages on Wikia
         * @param {String} list List of supported languages
         * @param {Object} langs API query with a list of languages
         */
        initLanguages: function(list, langs) {
            list = JSON.parse(list.replace(/\/\*.*\*\//g, ''));
            this.languages = {};
            langs.query.languages.forEach(function(lang) {
                var code = lang.code;
                if (list.indexOf(code) !== -1) {
                    this.languages[lang.code] = lang['*'];
                }
            }, this);
        },
        /**
         * Initializes the list of all translation pages
         * @param {Object} pages API query with a list of pages
         */
        initAllpages: function(pages) {
            this.pages = pages.query.allpages.filter(function(el) {
                var title = el.title;
                return title.slice(-10) === '/i18n.json' &&
                       title.slice(0, 17) === 'MediaWiki:Custom-';
            });
        },
        /**
         * Initializes this.icons object as a map of icon
         * names to icon nodes
         */
        initIcons: function() {
            var args = [].slice.call(arguments), ics = {};
            this.icons.forEach(function(icon, i) {
                ics[icon] = $(args[i][0]).find('svg')[0];
            });
            this.icons = ics;
        },
        /**
         * Initialized "back" links in the page subtitle
         */
        initBreadcrumbs: function() {
            if (!this.page) {
                return;
            }
            var $subtitle = $('.page-header__page-subtitle, #contentSub');
            if (this.lang) {
                $subtitle.prepend(
                    this.ui({
                        type: 'a',
                        attr: {
                            href: this.getUrl(this.page)
                        },
                        text: this.page
                    }),
                    ' | '
                );
            }
            $subtitle.prepend(
                '< ',
                this.ui({
                    type: 'a',
                    attr: {
                        href: this.getUrl()
                    },
                    text: this.msg('search-title')
                }),
                ' | '
            );
        },
        /**
         * Initializes things that need to be initialized every time
         * the editor mode is switched
         */
        reInit: function() {
            this.initVars();
            this.initBreadcrumbs();
            if (this.page) {
                if (this.lang) {
                    if (this.lang === 'metadata') {
                        this.initMetadataEditor();
                    } else {
                        this.initTranslationEditor();
                    }
                } else {
                    this.initTranslationPicker();
                }
            } else {
                this.initSearch();
            }
        },
        /**
         * Sets the title and header of the page
         * @param {String} msg Message code of the title message
         * @param {String} header Message to put into the page header
         */
        setContent: function(msg, header, content, buttons) {
            document.title = 'I18nEdit | ' + this.i18n.msg('title-' + msg, this.page, this.lang).plain();
            $('.page-header__title, #firstHeading').text(header);
            $('#mw-content-text').html(this.ui(content));
            if (buttons) {
                $('.page-header__contribution-buttons').html(this.ui(buttons));
            }
        },
        /**
         * Gets the URL for specified subpage of I18nEdit interface
         * @param {String} page Script to translate
         * @param {String} lang Language to translate to
         * @returns {String} URL of the interface page
         */
        getUrl: function(page, lang) {
            var url = 'Special:BlankPage/I18nEdit';
            if (page) {
                url += '/' + page;
            }
            if (lang) {
                url += '/' + lang;
            }
            return mw.util.getUrl(url);
        },
        /**
         * Initializes the "script search" interface, which
         * lists translatable scripts
         * @param {Object} pages API call result for list=allpages
         */
        initSearch: function() {
            this.setContent('search', this.msg('search-title'), {
                type: 'div',
                classes: ['I18nEditMain', 'I18nEditSearch'],
                children: [
                    {
                        type: 'p',
                        attr: { id: 'I18nEditSearchText' },
                        text: this.msg('search-text')
                    },
                    /*
                    {
                        type: 'fieldset',
                        classes: ['collapsible'],
                        children: [
                            {
                                type: 'legend',
                                text: this.msg('search-legend')
                            },
                            {
                                type: 'form',
                                attr: {
                                    method: 'GET',
                                    id: 'I18nEditSearchForm'
                                },
                                children: [
                                    {
                                        type: 'input',
                                        attr: {
                                            type: 'submit',
                                            value: this.msg('search-button')
                                        },
                                        events: {
                                            click: function(e) {
                                                e.preventDefault();
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    },
                    */
                    {
                        type: 'ul',
                        attr: { id: 'I18nEditSearchList' },
                        children: this.pages.map(function(p) {
                            var title = p.title.slice(17, -10);
                            return {
                                type: 'li',
                                children: [
                                    {
                                        type: 'a',
                                        attr: { href: this.getUrl(title) },
                                        text: title
                                    }
                                ]
                            };
                        }, this)
                    }
                ]
            });
        },
        /**
         * Initializes the "translation picker" interface, which appears
         * after selecting a script to translate, lists all languages
         * the script is already translated to, allows adding new
         * translations and editing metadata
         */
        initTranslationPicker: function() {
            this.formChildren = $.map(this.languages, $.proxy(function(v, k) {
                return {
                    type: 'li',
                    classes: [this.scriptI18n._messages[k] ? 'exists' : 'noexist'],
                    children: [
                        {
                            type: 'input',
                            classes: ['I18nEditPickerFormRadio'],
                            attr: {
                                type: 'radio',
                                name: 'lang',
                                value: k,
                                id: 'lang-' + k
                            },
                            events: {
                                change: function() {
                                    $('#I18nEditPickerLanguage').removeAttr('disabled');
                                }
                            }
                        },
                        {
                            type: 'label',
                            attr: {
                                'for': 'lang-' + k
                            },
                            text: v + ' (' + k + ')'
                        }
                    ]
                };
            }, this));
            this.setContent('picker', this.page, {
                type: 'div',
                classes: ['I18nEditMain', 'I18nEditPicker', 'script-' + this.page],
                children: [
                    {
                        type: 'p',
                        attr: { id: 'I18nEditPickerText' },
                        text: this.msg('picker-text')
                    },
                    {
                        type: 'form',
                        attr: {
                            id: 'I18nEditPickerForm',
                            method: 'GET'
                        },
                        children: [
                            {
                                type: 'input',
                                attr: {
                                    name: 'page',
                                    type: 'hidden',
                                    value: this.page
                                }
                            },
                            {
                                type: 'ul',
                                attr: { id: 'I18nEditPickerFormList' },
                                children: this.formChildren
                            }
                        ]
                    }
                ]
            }, {
                type: 'div',
                classes: ['wds-button-group'],
                attr: {
                    id: 'I18nEditPickerButtons'
                },
                children: [
                    {
                        type: 'button',
                        classes: ['wds-is-squished', 'wds-button'],
                        attr: {
                            id: 'I18nEditPickerLanguage',
                            disabled: ''
                        },
                        events: {
                            click: function(e) {
                                e.preventDefault();
                                if ($(this).attr('disabled') === 'disabled') {
                                    return;
                                }
                                var value = $('.I18nEditPickerFormRadio:checked').val();
                                if (value) {
                                    window.location.pathname += '/' + value;
                                }
                            }
                        },
                        children: [
                            this.generateIcon('pencil', 'small'),
                            {
                                type: 'span',
                                text: this.msg('edit-language')
                            }
                        ]
                    },
                    {
                        type: 'div',
                        classes: ['wds-dropdown'],
                        children: [
                            {
                                type: 'div',
                                classes: ['wds-button', 'wds-is-squished', 'wds-dropdown__toggle'],
                                children: [
                                    this.generateIcon('dropdown', 'tiny')
                                ]
                            },
                            {
                                type: 'div',
                                attr: {
                                    'class': 'wds-dropdown__content wds-is-not-scrollable wds-is-right-aligned'
                                },
                                children: [
                                    {
                                        type: 'ul',
                                        classes: ['wds-list', 'wds-is-linked'],
                                        children: [
                                            this.generateOption(
                                                'add-new-language',
                                                'AddLanguage',
                                                '#',
                                                $.proxy(this.showLanguageModal, this)
                                            ),
                                            this.generateOption(
                                                'edit-metadata',
                                                'Metadata',
                                                this.getUrl(this.page, 'metadata')
                                            ),
                                            this.generateOption(
                                                'edit-qqq',
                                                'QQQ',
                                                this.getUrl(this.page, 'qqq')
                                            )
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            });
        },
        /**
         * Generates an option in the edit dropdown
         * @param {String} msg I18n message in the option
         * @param {String} id ID of the option
         * @param {String} href Location the link is pointing to
         * @param {Function} func Callback function after clicking the link
         * @returns {Object} UI-js object for the option
         */
        generateOption: function(msg, id, href, func) {
            var opts = {
                type: 'li',
                children: [
                    {
                        type: 'a',
                        attr: {
                            href: href,
                            id: 'I18nEditPicker' + id
                        },
                        text: this.msg(msg)
                    }
                ]
            };
            if (func) {
                opts.events = { click: func };
            }
            return opts;
        },
        /**
         * Generates a SVG icon from WDS
         * @param {String} name Name of the icon
         * @param {String} size Size of the icon
         * @return {Object} UI-js object for the icon
         */
        generateIcon: function(name, size) {
            var classes = ['wds-icon'];
            if (size) {
                classes.push('wds-icon-' + size);
                name += '-' + size;
            }
            if (this.icons[name]) {
                return this.icons[name];
            }
            return {
                type: 'svg',
                classes: classes,
                children: [
                    {
                        type: 'use',
                        attr: {
                            'xlink:href': '#wds-icons-' + name
                        }
                    }
                ]
            };
        },
        /**
         * Shows the modal with languages the script can be
         * additionally translated to
         * @param {Event} e Click event
         */
        showLanguageModal: function(e) {
            e.preventDefault();
            $.showCustomModal(this.escaped('add-new-language'), this.ui({
                children: [
                    {
                        type: 'label',
                        attr: {
                            id: 'I18nEditPickerFilterLabel',
                            'for': 'I18nEditPickerFilter'
                        },
                        text: this.msg('filter')
                    },
                    {
                        type: 'input',
                        attr: {
                            id: 'I18nEditPickerFilter',
                            name: 'I18nEditPickerFilter',
                            type: 'text',
                            value: localStorage.getItem('i18nEdit-filter') || conf.wgUserLanguage
                        },
                        events: {
                            input: this.filterLanguages
                        }
                    },
                    {
                        type: 'div',
                        attr: {
                            id: 'I18nEditPickerModalList'
                        },
                        children: this.formChildren.map(function(elem) {
                            elem.children = elem.children.map(function(child) {
                                if (child.attr.id) {
                                    child.attr.id = 'modal-' + child.attr.id;
                                } else {
                                    child.attr['for'] = 'modal-' + child.attr['for'];
                                }
                                return child;
                            });
                            return elem;
                        })
                    }
                ]
            }), {
                id: 'I18nEditPickerModal',
                buttons: [
                    {
                        id: 'I18nEditPickerModalClose',
                        message: this.escaped('close'),
                        handler: function() {
                            $('#I18nEditPickerModal').closeModal();
                        }
                    },
                    {
                        id: 'I18nEditPickerModalAdd',
                        message: this.escaped('add-language'),
                        defaultButton: true,
                        handler: function() {
                            var $this = $(this);
                            if ($this.attr('disabled') === 'disabled') {
                                return;
                            }
                            var $radio = $('#I18nEditPickerModalList input:checked'),
                            lang = $radio.attr('value');
                            if (!lang) {
                                return;
                            }
                            window.location.pathname += '/' + lang;
                        }
                    }
                ],
                callback: $.proxy(function() {
                    this.filterLanguages({ target: $('#I18nEditPickerFilter')[0] });
                    var $btn = $('#I18nEditPickerModalAdd');
                    $btn.attr('disabled', '');
                    $('#I18nEditPickerModalList input, #I18nEditPickerModalList label').click(function() {
                        $btn.removeAttr('disabled');
                    });
                    $('#I18nEditPickerFilter').popover({
                        content: this.ui({
                            type: 'div',
                            attr: {
                                id: 'I18nEditPickerFilterPopover'
                            },
                            text: this.msg('language-popover')
                        }),
                        placement: 'top'
                    });
                }, this)
            });
        },
        /**
         * Filters languages in the modal after using the
         * search bar
         * @param {Event} e Input event
         */
        filterLanguages: function(e) {
            var val = e.target.value.toLowerCase(),
            filters = val.split('|');
            localStorage.setItem('i18nEdit-filter', val);
            $('#I18nEditPickerModalList .noexist').hide().filter(function() {
                var $this = $(this),
                text = $this.text().toLowerCase(),
                indexes = 0;
                filters.forEach(function(lang) {
                    indexes += text.indexOf(lang);
                });
                return indexes !== -filters.length;
            }).show();
        },
        /**
         * Initializes the metadata editor interface
         */
        initMetadataEditor: function() {
            var messages = this.scriptI18n._messages,
                meta = messages._metadata || {},
                translate = Object.keys(messages.en),
                noTranslate = meta.noTranslate || [];
            noTranslate.forEach(function(nt) {
                var index = translate.indexOf(nt);
                if (index !== -1) {
                    translate.splice(index, 1);
                }
            });
            this.setContent('metadata', this.i18n.msg('metadata-title', this.page).plain(), {
                type: 'div',
                classes: ['I18nEditMetadata', 'I18nEditEditor'],
                children: [
                    {
                        type: 'p',
                        attr: { id: 'I18nEditMetadataEditorWarning' },
                        text: this.msg('warning-metadata')
                    },
                    {
                        type: 'p',
                        attr: { id: 'I18nEditMetadataEditorText' },
                        text: this.msg('metadata-editor-text')
                    },
                    {
                        type: 'fieldset',
                        children: [
                            {
                                type: 'select',
                                attr: { id: 'I18nEditMetadataSelect' },
                                children: translate.map(function(t) {
                                    return {
                                        type: 'option',
                                        text: t
                                    };
                                })
                            },
                            {
                                type: 'option',
                                classes: ['wds-button', 'wds-is-squished'],
                                attr: {
                                    disabled: '',
                                    id: 'I18nEditMetadataAddMessage'
                                },
                                events: {
                                    click: $.proxy(function() {
                                        var $sel = $('#I18nEditMetadataSelect');
                                        if (!$sel.val()) {
                                            return;
                                        }
                                        var $opt = $sel.find(':selected'),
                                            val = $opt.val();
                                        this.ui({
                                            type: 'li',
                                            text: val,
                                            classes: ['I18nEditMetadataListItem'],
                                            data: {
                                                value: val
                                            },
                                            children: [' [', {
                                                type: 'a',
                                                classes: ['I18nEditRemoveMessage'],
                                                attr: { href: '#' },
                                                events: {
                                                    click: $.proxy(function(e) {
                                                        e.preventDefault();
                                                        var $li = $(e.target).closest('li');
                                                        this.ui({
                                                            type: 'option',
                                                            text: $li.data('value'),
                                                            parent: '.I18nEditMetadataSelect'
                                                        });
                                                        $('#I18nEditMetadataAddMessage').removeAttr('disabled');
                                                        $li.remove();
                                                    }, this)
                                                },
                                                text: 'remove'
                                            }, ']'],
                                            parent: '#I18nEditMetadataUL'
                                        });
                                        $opt.remove();
                                        if ($sel.children().length === 0) {
                                            $('#I18nEditMetadataAddMessage').attr('disabled', 'disabled');
                                        }
                                    }, this)
                                },
                                text: this.msg('add-message')
                            },
                            {
                                type: 'ul',
                                classes: ['wds-list'],
                                attr: { id: 'I18nEditMetadataUL' }
                            }
                        ]
                    },
                    {
                        type: 'a',
                        classes: ['wds-button', 'wds-is-squished'],
                        events: {
                            click: $.proxy(function(e) {
                                var $childs = $('.I18nEditMetadataUL').children();
                                if (!$childs.length) {
                                    delete this.messages._metadata;
                                } else {
                                    this.messages._metadata = {
                                        noTranslate: $childs.toArray().map(function(el) {
                                            return el.getAttribute('data-value');
                                        }).sort()
                                    };
                                }
                                this.saveTranslations(e);
                            }, this)
                        },
                        text: this.msg('save-metadata')
                    }
                ]
            });
            window.dev.i18n.loadMessages(this.page).done($.proxy(this.cbMessagesLoad3, this));
        },
        makeListItem: function() {
            return {
                type: 'li'
            };
        },
        cbMessagesLoad3: function(i18n) {
            this.messages = i18n._messages;
            var meta = this.messages._metadata = $.extend({
                noTranslate: []
            }, this.messages._metadata),
            messages = Object.keys(this.messages.en);
            $.each(meta.noTranslate, $.proxy(function(i, val) {
                messages.splice(messages.indexOf(val), 1);
                this.ui({
                    type: 'li',
                    text: val,
                    attr: {
                        'class': 'I18nEditMetadataListItem'
                    },
                    data: {
                        value: val
                    },
                    children: [' [', {
                        type: 'a',
                        attr: {
                            href: '#',
                            'class': 'I18nEditRemoveMessage'
                        },
                        events: {
                            click: $.proxy(function(e) {
                                var $li = $(e.target).closest('li');
                                this.ui({
                                    type: 'option',
                                    text: $li.data('value'),
                                    parent: '.I18nEditMetadataSelect'
                                });
                                $('.I18nEditMetadataAddMessage').removeAttr('disabled');
                                $li.remove();
                            }, this)
                        },
                        text: 'remove'
                    }, ']'],
                    parent: '.I18nEditMetadataUL'
                });
            }, this));
            $.each(messages, $.proxy(function(i, val) {
                this.ui({
                    type: 'option',
                    text: val,
                    parent: '.I18nEditMetadataSelect'
                });
            }, this));
            if (messages.length) {
                $('.I18nEditMetadataAddMessage').removeAttr('disabled');
            }
        },
        /**
         * Initializes the translation editor interface
         */
        initTranslationEditor: function() {
            var lang = this.lang,
                messages = this.scriptI18n._messages;
            messages[lang] = $.extend({}, messages.en, messages[lang] || {});
            if (messages._metadata && messages._metadata.noTranslate instanceof Array && lang !== 'en') {
                messages._metadata.noTranslate.forEach(function(msg) {
                    delete messages[lang][msg];
                });
            }
            this.messages = messages;
            this.setContent('editor', this.page, {
                type: 'div',
                classes: [
                    'I18nEditMain',
                    'I18nEditEditor',
                    'script' + this.page,
                    'lang-' + lang
                ],
                children: [
                    {
                        type: 'p',
                        attr: { id: 'I18nEditEditorWarning' },
                        text: this.msg('warning-' + lang),
                        condition: ['en', 'qqq'].indexOf(lang) !== -1
                    },
                    {
                        type: 'table',
                        classes: ['wikitable'],
                        attr: { id: 'I18nEditEditorTable' },
                        children: [
                            {
                                type: 'tr',
                                children: [
                                    'code',
                                    'description',
                                    'english',
                                    'translation'
                                ].map(function(el) {
                                    return {
                                        type: 'th',
                                        text: this.msg('editor-table-' + el)
                                    };
                                }, this)
                            }
                        ].concat($.map(messages[lang], $.proxy(this.makeRow, this)))
                    },
                    {
                        type: 'span',
                        classes: ['I18nEditEditorSummaryWrap'],
                        children: [
                            {
                                type: 'input',
                                attr: {
                                    type: 'text',
                                    placeholder: this.msg('summary'),
                                    id: 'I18nEditSummary'
                                }
                            },
                            {
                                type: 'span',
                                classes: ['I18nEditEditorSummaryUnderline']
                            }
                        ]
                    },
                    {
                        type: 'button',
                        classes: ['I18nEditEditorButton', 'wds-is-squished', 'wds-button'],
                        attr: { id: 'I18nEditEditorSubmit' },
                        events: { click: $.proxy(this.saveTranslations, this) },
                        text: this.msg('editor-save')
                    },
                    {
                        type: 'button',
                        classes: ['I18nEditEditorButton', 'wds-is-squished', 'wds-button'],
                        attr: { id: 'I18nEditEditorNewMessage' },
                        events: {
                            click: $.proxy(this.newMessage, this)
                        },
                        text: this.msg('add-new-message'),
                        condition: lang === 'en'
                    }
                ]
            });
        },
        makeRow: function(v, k) {
            return {
                type: 'tr',
                data: { code: k },
                children: [
                    {
                        type: 'td',
                        children: [
                            {
                                type: 'code',
                                text: k
                            }
                        ]
                    },
                    {
                        type: 'td',
                        text: this.messages.qqq && this.messages.qqq[k] || 'N/A'
                    },
                    {
                        type: 'td',
                        text: this.messages.en[k] || 'N/A'
                    },
                    {
                        type: 'td',
                        children: [
                            {
                                type: 'input',
                                classes: ['I18nEditTranslateInput'],
                                attr: {
                                    type: 'text',
                                    value: v
                                }
                            }
                        ]
                    }
                ]
            };
        },
        newMessage: function(e) {
            e.preventDefault();
            var key = prompt(this.msg('message-code'));
            if (!key || $('#I18nEditEditorTable tr[data-code="' + key + '"]').length) {
                return;
            }
            if (this.messages.qqq) {
                var qqq = prompt(this.msg('message-qqq'));
                if (qqq) {
                    this.messages.qqq[key] = qqq;
                }
            }
            this.ui($.extend(this.makeRow('', key), { parent: '#I18nEditEditorTable' }));
        },
        /**
         * Saves the translations to the respective JSON page
         * @param {Event} e Click event
         */
        saveTranslations: function(e) {
            e.preventDefault();
            var lang = this.lang,
            changedMessages = [];
            // Re-add removed translations by _metadata.noTranslate
            $.extend(this.messages[lang], lang === 'metadata' ? null : this.messages.en, this.messages[lang]);
            $('#I18nEditEditorTable .I18nEditTranslateInput').each($.proxy(function(_, el) {
                var $this = $(el),
                code = $this.parent().parent().data('code'),
                val = $this.val();
                if (this.messages[lang][code] === val) {
                    return;
                }
                if (this.messages[lang][code]) {
                    changedMessages.push(code);
                }
                if (lang !== 'metadata') {
                    this.messages[lang][code] = $this.val();
                }
            }, this));
            // If the user changed English messages already translated
            if (lang === 'en' && changedMessages.length) {
                var confirmation = confirm(this.msg('remove-translations-prompt'));
                if (confirmation) {
                    $.each(this.messages, $.proxy(function(i) {
                        if (i === '_metadata') {
                            return;
                        }
                        $.each(changedMessages, $.proxy(function(j, msg) {
                            if (
                                this.messages._metadata &&
                                this.messages._metadata.noTranslate instanceof Array &&
                                this.messages._metadata.noTranslate.indexOf(msg) === -1
                            ) {
                                this.messages[i][msg] = this.messages.en[msg];
                            }
                        }));
                    }, this));
                }
            }
            // Sort object keys, with exceptions
            var messages = {},
            specials = {
                _metadata: 1,
                en: 2,
                qqq: 3
            };
            Object.keys(this.messages).sort(function(a,b) {
                if (specials[a] && specials[b]) {
                    return specials[a] - specials[b];
                } else if (specials[a]) {
                    return -1;
                } else if (specials[b]) {
                    return 1;
                } else {
                    return a.localeCompare(b);
                }
            }).forEach(function(key) {
                messages[key] = this.messages[key];
            }, this);
            this.startLoading();
            this.api.postWithEditToken({
                action: 'edit',
                title: 'MediaWiki:Custom-' + this.page + '/i18n.json',
                text: '// <syntaxhighlight lang="javascript">\n' + JSON.stringify(messages, null, 4),
                summary: '[I18nEdit] ' + ($('#I18nEditSummary').val() || this.msg('summary')),
                minor: true,
                bot: true
            }).done($.proxy(this.cbSave, this));
        },
        /**
         * Callback after the page has been saved
         * @param {Object} d API result
         */
        cbSave: function(d) {
            this.stopLoading();
            if(d.error) {
                new BannerNotification(this.escaped('error') + ': ' + d.error.code, 'error').show();
            } else {
                localStorage.removeItem('I18nEdit/' + this.page);
                new BannerNotification(this.escaped('success'), 'confirm').show();
                setTimeout($.proxy(function() {
                    window.location.pathname = '/wiki/Special:Blankpage/I18nEdit/' + this.page;
                }, this), 2000);
            }
        },
        /**
         * Returns a message with specified code as plain
         * @param {String} msg Code of the message
         * @returns {String} Translated message with the specified code
         */
        msg: function(msg) {
            return this.i18n.msg(msg).plain();
        },
        /**
         * Returns a message with specified code, escaped
         * @param {String} msg Code of the message
         * @returns {String} Translated message with the specified code, escaped
         */
        escaped: function(msg) {
            return this.i18n.msg(msg).escape();
        }
    };
    // Loading necessary resources
    importArticles(
        {
            type: 'script',
            articles: [
                'u:dev:MediaWiki:I18n-js/code.js',
                'u:dev:MediaWiki:UI-js/code.js'
            ]
        },
        {
            type: 'style',
            articles: [
                'u:dev:MediaWiki:I18n-js/editor.css'
            ]
        }
    );
    // Run the main when scripts loads
    mw.loader.using(['mediawiki.api.edit', 'mediawiki.util']).then(function() {
        mw.hook('dev.ui').add($.proxy(I18nEdit.preload, I18nEdit));
    });
})();