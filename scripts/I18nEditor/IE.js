// ==UserScript==
// @name         I18nEdit
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Hope I remove this before publishing lol
// @author       You
// @match        https://dev.fandom.com/wiki/*
// @grant        none
// ==/UserScript==


/* I18nEditor
 * - Does not support Edge
 *
 * All-in-one editor for editing i18n files for JavaScript and Lua
 * Designed with usage on Fandom Developers Wiki in mind, but there is no wiki lock-in put in place
 *
 * @author Dorumin
 */

/* TODO:
 *
 * Lua translating
 * Language picker
 * Translation UI
 * Translating mw messages, maybe
 */

// REMOVE WHEN IN PRODUCTION
window.dev = $.extend(true, window.dev, {
    i18n: {
        overrides: {
            I18nEditor: {
                'document-title': 'I18nEdit | $1 | $2',
                'language-count': '{{PLURAL:$1|$1 language|$1 languages}}',
                'add-language': 'Add language',
                'edit': 'Edit',
                'edit-qqq': 'Edit descriptions',
                'edit-metadata': 'Edit metadata',
                'lang-missing': '$1 missing',
                'missing': 'missing', // Unused
                'lang-incomplete': '$1 incomplete',
                'incomplete': 'incomplete',
                'search-filter-legend': 'Search',
                'view-credits': 'View credits',
                'translate-from': 'Translate from:',
                'translate-to': 'Translate to:',
                'picker-search-placeholder': 'Search languages',
                'picker-error-empty': 'This page has no valid languages to translate from. Sorry about that, we will get on fixing it soon. Please report this in the [[Talk:$1|script talk page]]!'
            }
        }
    }
});

// Start
(function() {
    // Double runs
    if (
        window.I18nEdit && I18nEdit.init
    ) return;

    // Some things that will be useful when trying to figure out what the fuck is going on:
    // - build* methods return new objects to be fed into dev.ui
    // - render* methods actually display stuff on the page and perform side effects
    // - replace* methods replace sections of the DOM with refreshed elements
    // - fetch* methods fetch stuff from the network and usually call back to on* methods for side effects
    // - on* methods are called after events and they perform side effects
    // - get* methods parse data and return them synchronously for usage in other functions
    // - set* methods update the state given some input
    // - read* methods parse data and update the state, basically getset

    /**
     * An object representing an i18n page
     *
     * @typedef {Object} Page
     * @property {string} title - The page full title
     * @property {string} name - The script name, stripping MediaWiki:Custom- and /i18n.json from the  full title
     * @property {?number} id - The page id, may be missing
     * @property {?Object.<string, !Object>} json - The page content, may be missing
     */

    // TODO: Determine whether goes on dev namespace or not
    window.I18nEdit = $.extend({
        state: {
            name: 'I18nEdit',
            // Languages known by the user, and kept for shortcuts
            userLangs: ['en'],
            // Language codes mapped by name
            languageNames: {},
            // Language names mapped by code, yeah I dunno if there's a better way to do this
            codes: {},
            // Languages you're translating to
            langs: [],
            // Decides whether the page should be faded in
            firstPage: false,
            // I18n pages data
            i18nPages: {},
            // Selected languge to translate from
            selectedLang: '',
            // Selected languages to translate to, decoupled from state.langs
            selectedLangs: [],
            // Picker search value
            pickerSearch: '',
            // Languages filtered by pickerSearch
            filteredLangs: [],
            // Filter search state
            filter: {
                langs: []
            }
        },
        /**
         * List of languages not supported by Wikia. Correct per:
         * https://github.com/Wikia/app/blob/4cda276c23a154186ea27c686dbd1ff57a7039dd/languages/WikiaLanguage.php#L42-L89
         */
        blacklist: [
            'als',
            'an',
            'ang',
            'ast',
            'bar',
            'de2',
            'de-at',
            'de-ch',
            'de-formal',
            'de-weigsbrag',
            'dk',
            'en-gb',
            'eshelp',
            'fihelp',
            'frc',
            'frhelp',
            'ia',
            'ie',
            'ithelp',
            'jahelp',
            'kh',
            'kohelp',
            'kp',
            'ksh',
            'nb',
            'nds',
            'nds-nl',
            'mu',
            'mwl',
            'nlhelp',
            'pdc',
            'pdt',
            'pfl',
            'pthelp',
            'pt-brhelp',
            'ruhelp',
            'simple',
            'tokipona',
            'tp',
            'zh-classical',
            'zh-cn',
            'zh-hans',
            'zh-hant',
            'zh-min-nan',
            'zh-mo',
            'zh-my',
            'zh-sg',
            'zh-yue'
        ],
        /**
         * Wiki global variable cache
         */
        wg: mw.config.get([
            'wgCanonicalSpecialPageName',
            'wgPageName',
            'wgLoadScript',
            'wgScriptPath',
            'wgArticlePath',
            'wgSiteName'
        ]),
        /**
         * Stack keeping track of loaded dependencies
         */
        loading: [
            'i18n',
            'lang',
            'api',
            'wds',
            'spinner',
            'settings',
            'autocomplete', // TODO: Remove when ported
            'ui',
            'sitelangs',
            'styles',
        ],
        /**
         * Called each time a dependency is called
         * It is an error to call without a type
         *
         * @param {!string} type - A string that identifies which dependency was loaded, must be included in [this.loading]
         * @param {?any} arg - argument passed to be handled by this function
         */
        onload: function(type, arg) {
            switch (type) {
                case 'i18n':
                    arg.loadMessages('I18nEditor').then(this.onload.bind(this, 'lang'));
                    break;
                case 'lang':
                    this.i18n = arg;
                    break;
                case 'api':
                    this.api = new mw.Api();
                    this.fetchLanguages();
                    // TODO(Doru): Fetch i18n pages? Scope to Lua/JS? Fetch them all?
                    break;
                case 'wds':
                    this.wds = arg;
                    break;
                case 'spinner':
                    this.Spinner = arg;
                    break;
                case 'settings':
                    if (arg.langs) {
                        this.state.userLangs = arg.langs;
                    }
                    break;
            }

            this.loading.splice(this.loading.indexOf(type), 1);

            if (this.loading.length !== 0) return;
            this.init();
        },
        /**
         * Utility function to chunk an array into smaller arrays with a set size or lower
         *
         * @param {any[]} arr - The array to split up
         * @param {number} size - The size of the array slices
         */
        chunk: function(arr, size) {
            var final = [];
            var i = 0;
            while (arr.length > i) {
                final.push(arr.slice(i, i += size));
            }
            return final;
        },
        /**
         * Defers a function to the next tick or set delay and binds to I18nEdit as its context
         *
         * @param {Function} fn - Function to call
         * @param {?number} ms - Execution delay in milliseconds
         */
        // Defers a function and binds to own context
        defer: function(fn, ms) {
            return $.debounce(ms || 0, fn.bind(this));
        },
        // Methods related to url address reading/modifying/listening
        // Get current state path
        // Reckless code "fixers": DO NOT USE mw.util.getUrl, we DON'T want to encode it
        getPath: function() {
            const path = [
                this.state.blankpage,
                this.state.name,
                this.state.lua,
                this.state.page,
                this.state.from == 'en' ? null : this.state.from,
                this.state.langs.join('.')
            ].filter(Boolean).join('/');

            this.wg.wgPageName = path;
            return this.wg.wgScriptPath + this.wg.wgArticlePath.replace('$1', path) + location.search + location.hash;
        },
        // Set url path, should refresh UI with onPopState magic
        setPath: function(state) {
            var oldPath = this.getPath();
            $.extend(this.state, state);
            var newPath = this.getPath();

            history.pushState(state, null, newPath);

            if (oldPath != newPath) {
                this.onPopState();
            }
        },
        // Read url and save it in this.state
        readPath: function(path) {
            var parts = path.split('/');

            if (parts[0] === '') {
                parts.shift();
            }

            if (parts[0] === 'wiki') {
                parts.shift();
            }

            console.log(parts);
            this.state.blankpage = parts.shift();
            parts.shift(); // Discard /I18nEdit

            if (parts[0] == 'Lua') {
                this.state.lua = true;
                parts.shift();
            } else {
                this.state.lua = false;
            }

            this.state.page = parts.shift();

            var from = parts.shift();
            var lang = parts.shift();
            if (!lang) {
                lang = from;
                if (from) {
                    from = 'en';
                }
            }
            if (lang) {
                console.log(from, lang);
            }
            if (from) {
                this.state.from = from;
            }
            if (lang) {
                this.state.langs = lang.split('.');
            }

            return this.state;
        },
        /**
         * Sets the user's languages
         *
         * @param {string} langs - The new languages
         */
        setUserLangs: function(langs) {
            this.state.userLangs = langs;

            this.saveSettings();
        },
        // Called when the URL changes, hopefully
        onPopState: function() {
            this.readPath(location.pathname);
            console.log('State popped, refresh UI', this.state);

            this.rebuildUI();
            this.replaceBreadcrumbs();

            this.scrollToTop();
        },
        // Scrolls to top. You don't need me to tell you this you're a big boy
        scrollToTop: function() {
            document.scrollingElement.scrollTop = 0;
        },
        // Turn a script title into a Custom-/i18n.json string
        pageToTitle: function(page) {
            return 'MediaWiki:Custom-' + page + '/i18n.json';
        },
        // Gets the current i18n page object, or null
        getPage: function() {
            return this.state.i18nPages[this.state.page] || null;
        },
        // Whether the script should run, doesn't include double run protection that is at the beginning of the file
        shouldRun: function() {
            return (
                this.wg.wgCanonicalSpecialPageName == 'Blankpage' &&
                this.wg.wgPageName.split('/')[1] == this.state.name
            );
        },
        bindEvents: function() {
            window.addEventListener('popstate', this.onPopState.bind(this));
        },
        // Build the UI depending on what the current state is
        buildUI: function() {
            if (this.state.langs && this.state.langs.length) {
                this.renderTranslator();
            } else if (this.state.page) {
                this.renderLanguageList();
            } else if (this.state.lua) {
                this.renderLuaListing();
            } else {
                this.renderPageListing();
            }

            this.state.firstPage = true;
        },
        rebuildUI: function() {
            this.state.firstPage = false;

            this.buildUI();
        },
        // Route render methods
        // Render method for route /I18nEdit/$page/$lang
        renderTranslator: function() {
            // TODO: Translator
            console.log('Rendering translator');

            if (this.state.langs.length === 1) {
                this.setTitle('translator-single');
            } else {
                this.setTitle('translator-multi');
            }
        },
        // Render method for route /I18nEdit/$page
        renderLanguageList: function() {
            // TODO: Language list
            console.log('Rendering language list');

            this.setTitle('languages');
            this.setEditButtons({
                main: {
                    text: this.i18n.msg('edit').plain(),
                    icon: 'pencil-small',
                    classes: ['wds-is-disabled'],
                    attr: {
                        href: '#',
                        id: 'language-edit'
                    },
                    events: {
                        click: this.onClickOpenEditor.bind(this)
                    }
                },
                buttons: [
                    {
                        text: this.i18n.msg('edit-qqq').plain(),
                        attr: {
                            href: mw.util.getUrl('Special:BlankPage/I18nEdit/Test/qqq')
                        },
                        events: {
                            click: this.onDropdownLangClick.bind(this, 'qqq')
                        }
                    },
                    {
                        text: this.i18n.msg('edit-metadata').plain(),
                        attr: {
                            href: mw.util.getUrl('Special:BlankPage/I18nEdit/Test/_metadata')
                        },
                        events: {
                            click: this.onDropdownLangClick.bind(this, '_metadata')
                        }
                    },
                    {
                        text: this.i18n.msg('view-credits').plain(),
                        events: {
                            click: this.onDropdownLangClick.bind(this, 'credits')
                        }
                    },
                ]
            });
            this.setContent({
                type: 'div',
                classes: ['I18nEdit-route', 'I18nEdit-languagePicker'],
                children: [
                    this.getPage()
                        ? this.buildPickerContent()
                        : this.buildSpinner()
                ]
            });

            this.getCurrentPageI18n();
        },
        // Render method for route /I18nEdit/Lua
        renderLuaListing: function() {
            // TODO: Lua listing
            console.log('Rendering lua listing');

            this.setTitle('listing-lua');
            this.setEditButtons(null);
        },
        // Render method for route /I18nEdit
        renderPageListing: function() {
            // TODO: Page listing
            console.log('Rendering page listing');

            this.setTitle('listing');
            this.setEditButtons(null);
            this.setContent({
                type: 'div',
                classes: ['I18nEdit-route', 'I18nEdit-pageListing'],
                children: [
                    this.buildPageListingFilter(),
                    this.buildPageListingList(),
                ]
            });

            this.getAllI18nPages();
        },
        onClickOpenEditor: function(e) {
            e.preventDefault();
            console.log(e);
            console.log(e.currentTarget.classList.contains('wds-is-disabled'));
            this.setPath({
                langs: this.state.selectedLangs,
                from: this.state.selectedFrom
            });
        },
        onDropdownLangClick: function(special, e) {
            this.setPath({
                langs: [special]
            });
            e.preventDefault();
        },
        /**
         * Builds a route dev.ui object for the content in /I18nEdit/$page.
         *
         * @returns {dev.ui} The language picker object
         */
        buildPickerContent: function() {
            var lang = this.getFirstValidLanguage(this.getPage());
            if (!lang) {
                // TODO(Doru): Better error?
                return {
                    type: 'div',
                    classes: ['I18nEdit-pickerContent', 'I18nEdit-pickerError'],
                    children: [
                        {
                            type: 'div',
                            classes: ['I18n-pickerErrorMessage'],
                            html: this.i18n.msg('picker-error-empty', this.getPage().name).parse()
                        }
                    ]
                };
            }

            return {
                type: 'div',
                classes: ['I18nEdit-pickerContent'],
                children: [
                    {
                        type: 'div',
                        classes: ['I18nEdit-pickerTranslatingFrom', 'I18nEdit-pickerColumn'],
                        children: [
                            {
                                type: 'div',
                                classes: ['I18nEdit-pickerFromHint'],
                                text: this.i18n.msg('translate-from').plain()
                            },
                            this.buildPickerElement({
                                click: this.onClickChangeFrom.bind(this),
                                lang: lang,
                                data: this.getPage().json[lang],
                                en: this.getPage().json.en
                            }),
                        ]
                    },
                    {
                        type: 'div',
                        classes: ['I18nEdit-pickerTranslateTo', 'I18nEdit-pickerColumn'],
                        children: [
                            {
                                type: 'div',
                                classes: ['I18nEdit-pickerToHint'],
                                text: this.i18n.msg('translate-to').plain()
                            },
                            {
                                type: 'div',
                                classes: ['I18nEdit-pickerToSearch'],
                                children: [
                                    this.buildPickerSearch()
                                ]
                            },
                            {
                                type: 'div',
                                classes: ['I18nEdit-pickerToContainer'],
                                children: this.buildPickerLanguages({
                                    page: this.getPage(),
                                    click: this.onClickChangeTo,
                                    lang: lang
                                })
                            }
                        ]
                    }
                ]
            };
        },
        /**
         * Gets the first language you can translate from, using state.from, fallbacking to en, then to the first prop
         * TODO(Doru): Make it yoink from userLangs?
         *
         * @param {Page} page - The i18n page object with a json property
         */
        getFirstValidLanguage: function(page) {
            var obj = page.json;

            if (obj.hasOwnProperty(this.state.from)) {
                return this.state.from;
            }

            for (var i in this.state.userLangs) {
                var lang = this.state.userLangs[i]
                if (obj.hasOwnProperty(lang)) {
                    return lang;
                }
            }

            if (obj.hasOwnProperty('en')) {
                return 'en';
            }

            console.log('What the fuck?');
            return null;
        },
        /**
         * Event handler for changing the state languages to translate from.
         *
         * @param {Event} e - The click event
         * @sideeffects
         */
        onClickChangeFrom: function(e) {
            console.log('Clicked change from, show dropdown or smth');
        },
        /**
         * Builds a dev.ui object for a language element on either side of an i18n picker.
         *
         * @param {PickerOptions} options - The options to build the list
         * @returns {dev.ui[]} An array of valid picker element dev.ui objects
         *
         *
         * Options to build a language list
         * @typedef {Object} PickerOptions
         * @property {Page} page - The page being handled
         * @property {String} lang - The language being translated from, passed to [click]
         * @property {Function} click - The function called when an element is called
         */
        buildPickerLanguages: function(options) {
            var children = [],
            page = options.page,
            from = options.lang,
            click = options.click,
            langs = this.removeDuplicates(
                this.state.filteredLangs
                    .concat(this.state.selectedLangs, this.state.userLangs, Object.keys(page.json))
                    .sort(this.sortLanguages.bind(this, page))
            );

            console.log(langs);

            for (var i in langs) {
                var lang = langs[i],
                data = page.json[lang];

                if (lang != from && lang != 'qqq' && lang != '_metadata') {
                    children.push(
                        this.buildPickerElement({
                            click: click.bind(this, lang),
                            lang: lang,
                            data: data,
                            en: page.json.en
                        })
                    );
                }
            }

            return children;
        },
        replacePickerLanguages: function() {
            var lang = this.getFirstValidLanguage(this.getPage());
            if (!lang) {
                console.log('Uh-oh');
            }

            $('.I18nEdit-pickerToContainer').empty().append(dev.ui({
                children: this.buildPickerLanguages({
                    page: this.getPage(),
                    click: this.onClickChangeTo,
                    lang: lang
                })
            }));
        },
        /**
         * Sorts the languages rendered in the picker's right column
         * Goes from userLangs, to selectedLangs
         *
         * @param {Page} page - Page object
         * @param {string} a
         * @param {string} b
         */
        sortLanguages: function(page, a, b) {
            var langs = Object.keys(page.json).sort(this.alphabeticalSort);
            return this.includeCompare(this.state.filteredLangs, a, b)
                || this.includeCompare(this.state.userLangs, a, b)
                || this.includeCompare(langs, a, b)
                || this.includeCompare(this.state.selectedLangs, a, b);
        },
        /**
         *
         * @param {*} array
         * @param {*} a
         * @param {*} b
         */
        alphabeticalSort: function(a, b) {
            return b.localeCompare(a);
        },
        /**
         *
         * @param {*} array
         * @param {*} a
         * @param {*} b
         */
        includeCompare: function(array, a, b) {
            var ia = array.indexOf(a),
            ib = array.indexOf(b);
            if (ia != -1) {
                if (ib != -1) {
                    return 0;
                }
                return -1;
            }

            if (ib != -1) {
                if (ia != -1) {
                    return 0;
                }
                return 1;
            }

            return 0;
        },
        /**
         * Removes the duplicate entries in an array
         *
         * @param {string[]} array - Array to be filtered
         * @returns {string[]} Filtered array
         */
        removeDuplicates: function(array) {
            console.log(array);
            var seen = {};
            return array.filter(function(item) {
                if (seen[item]) return;
                seen[item] = true;
                return true;
            });
        },
        /**
         * Event handler for changing the state languages to translate to.
         *
         * @param {String} code - The language code to translate to
         * @param {Event} e - The click event
         * @sideeffects
         */
        onClickChangeTo: function(code, e) {
            var index = this.state.selectedLangs.indexOf(code);
            if (index == -1) {
                this.state.selectedLangs.push(code);
                this.state.selectedLangs.sort();
                e.currentTarget.classList.add('I18nEdit-selectedListElement');
            } else {
                this.state.selectedLangs.splice(index, 1);
                e.currentTarget.classList.remove('I18nEdit-selectedListElement');
            }

            if (this.state.selectedLangs.length) {
                var langs = '';
                if (this.state.from) {
                    langs += this.state.from + '/';
                }

                langs += this.state.selectedLangs.join('.');

                $('#language-edit')
                    .removeClass('wds-is-disabled')
                    .attr('href', mw.util.getUrl('Special:BlankPage/I18nEdit/Test/' + langs));
            } else {
                $('#language-edit')
                    .addClass('wds-is-disabled')
                    .attr('href', '#');
            }

            // this.replacePickerLanguages();
        },
        /**
         * Builds a dev.ui object for a language element on either side of an i18n picker.
         *
         * @param {Options} options - The options for the element
         * @returns {dev.ui} A dev.ui object representing that element
         */
        buildPickerElement: function(options) {
            var lang = options.lang,
            data = options.data,
            en = options.en,
            missing = !data,
            incomplete = !missing && en &&
                Object.keys(data).join('|') != Object.keys(en).join('|');

            return {
                type: 'div',
                classes: ['I18nEdit-pickerElement', 'I18nEdit-hoverableListElement']
                    .concat(this.state.selectedLangs.indexOf(lang) != -1
                        ? ['I18nEdit-selectedListElement']
                        : []
                    ),
                data: {
                    lang: lang
                },
                events: {
                    click: options.click
                },
                children: [
                    {
                        type: 'span',
                        classes: ['I18nEdit-pickerElementSpan'],
                        text: this.getLanguageFromCode(lang)
                    },
                    {
                        type: 'span',
                        classes: ['I18nEdit-pickerElementIncomplete', 'I18nEdit-details'],
                        condition: incomplete,
                        text: ' (' + this.i18n.msg('incomplete').plain() + ')'
                    },
                    {
                        type: 'span',
                        classes: ['I18nEdit-pickerElementMissing', 'I18nEdit-details'],
                        condition: missing,
                        text: this.i18n.msg('missing').plain()
                    }
                ]
            }
        },
        /**
         * Builds the search input on top of the language list to translate to.
         *
         * @returns {dev.ui} A dev.ui object representing the search input
         */
        buildPickerSearch: function() {
            return {
                type: 'input',
                classes: ['I18nEdit-input', 'I18nEdit-pickerSearch'],
                props: {
                    value: this.state.pickerSearch || ''
                },
                events: {
                    input: this.onPickerSearchChange.bind(this)
                },
                attr: {
                    placeholder: this.i18n.msg('picker-search-placeholder').plain()
                }
            }
        },
        /**
         * Event handler for the input event, which fires when the picker search changes.
         *
         * @param {Event} e - The event
         * @sideeffects
         */
        onPickerSearchChange: function(e) {
            this.state.pickerSearch = e.currentTarget.value;
            var query = this.state.pickerSearch.toLowerCase();

            this.state.filteredLangs = query.trim()
                ? Object.keys(this.state.codes).filter(function(code) {
                    return this.blacklist.indexOf(code) == -1 && (
                        code.toLowerCase().indexOf(query) != -1 ||
                        this.state.codes[code].toLowerCase().indexOf(query) != -1
                    );
                }, this)
                : [];

            this.replacePickerLanguages();
        },
        // Build methods for /I18nEdit
        buildPageListingFilter: function() {
            // TODO: Persist filters
            return {
                type: 'fieldset',
                classes: ['I18nEdit-listingFilter'],
                children: [
                    {
                        type: 'legend',
                        text: this.i18n.msg('search-filter-legend').plain()
                    },
                    {
                        type: 'input',
                        classes: ['I18nEdit-listingFilterTitleInput', 'I18nEdit-input'],
                        attr: {
                            type: 'search'
                        },
                        props: {
                            value: this.state.filter.search || ''
                        },
                        events: {
                            input: this.filterListingSearch.bind(this)
                        }
                    },
                    {
                        type: 'div',
                        classes: ['I18nEdit-listingFilterLanguages'],
                        children: this.state.filter.langs
                        .map(this.buildFilterChip.bind(this))
                        .concat(this.state.filter.typing ? [
                            {
                                type: 'span',
                                classes: ['I18nEdit-listingFilterLanguageChip', 'I18nEdit-listingFilterAddingLanguage'],
                                children: [
                                    {
                                        type: 'input',
                                        classes: ['I18nEdit-listingFilterAddingLanguageInput'],
                                        events: {
                                            blur: this.defer(this.onLangFilterBlur, 0),
                                            keyup: this.onLangFilterKeyup.bind(this)
                                        }
                                    }
                                ]
                            }
                        ] : [
                            {
                                type: 'span',
                                classes: ['I18nEdit-listingFilterLanguageChip', 'I18nEdit-listingFilterAddLanguage'],
                                text: this.i18n.msg('add-language').plain(),
                                events: {
                                    click: this.onStartLangTyping.bind(this)
                                }
                            }
                        ]),
                    }
                ]
            };
        },
        /**
         * Returns a language name from its code based on state.codes, or <code>
         *
         * @param {String} code - The ISO 639-1 language code to get the name of
         */
        getLanguageFromCode: function(code) {
            // Should render as <code> if not found, using i18n in case anything has to be hotfixed in
            return this.state.codes[code] || this.i18n.msg('lang-' + code).plain();
        },
        /**
         * Returns a language code from its name based on state.languageNames, or null
         *
         * @param {String} name - The language name to get the code of
         */
        getCodeFromLanguage: function(name) {
            return this.state.languageNames[name] || null;
        },
        buildFilterChip: function(lang) {
            return {
                type: 'span',
                classes: ['I18nEdit-listingFilterLanguageChip'],
                events: {
                    click: this.onRemoveLangFilter.bind(this, lang),
                },
                children: [
                    {
                        type: 'span',
                        classes: ['I18nEdit-listingFilterChipLabel'],
                        text: this.getLanguageFromCode(lang),
                    },
                    {
                        type: 'span',
                        classes: ['I18nEdit-listingFilterChipClose']
                    }
                ]
            };
        },
        buildPageListingList: function() {
            return {
                type: 'div',
                classes: ['I18nEdit-pageListingList'],
                children: this.state.i18nPageList
                    ? this.state.i18nPageList
                        .filter(this.filterElementList.bind(this))
                        .map(this.buildListingElement.bind(this))
                    : this.buildSpinner()
            };
        },
        buildListingElement: function(page) {
            return {
                type: 'div',
                classes: ['I18nEdit-listingElement', 'I18nEdit-hoverableListElement'],
                data: {
                    title: page.title
                },
                events: {
                    click: this.onElementClick.bind(this, page),
                },
                children: [
                    {
                        type: 'span',
                        classes: ['I18nEdit-elementTitle'],
                        text: page.name
                    },
                    {
                        type: 'span',
                        classes: ['I18nEdit-elementLanguages', 'I18nEdit-details'],
                        text: this.getLanguageText(page),
                        condition: page.json
                    }
                ]
            };
        },
        getLanguageText: function(page) {
            if (!page.json) return '';
            if (page.filter && (page.filter.missing.length || page.filter.incomplete.length)) {
                var flags = [];
                page.filter.missing.forEach(function(code) {
                    flags.push(this.i18n.msg('lang-missing', this.getLanguageFromCode(code)).parse());
                }, this);
                page.filter.incomplete.forEach(function(code) {
                    flags.push(this.i18n.msg('lang-incomplete', this.getLanguageFromCode(code)).parse());
                }, this);

                // TODO: Localise the comma?
                return ' (' + flags.join(', ') + ')';
            }
            return ' (' + this.i18n.msg('language-count', Object.keys(page.json).filter(this.notSpecialKey.bind(this)).length).parse() + ')';
        },
        notSpecialKey: function(key) {
            return key != 'qqq' || key != '_metadata';
        },
        buildSpinner: function() {
            console.log('Spinner rendered');
            return {
                type: 'div',
                html: new this.Spinner(38, 2).html,
            };
        },
        onElementClick: function(page, e) {
            this.setPath({
                page: page.name
            });
        },
        onStartLangTyping: function(e) {
            this.state.filter.typing = true;

            this.replaceListingFilter();

            $('.I18nEdit-listingFilterAddingLanguageInput')
                .focus()
                // TODO(Doru): Implement custom autocomplete logic, shouldn't be too hard
                .autocomplete({
                    appendTo: '.I18nEdit-listingFilter',
                    lookup: Object.keys(this.state.codes)
                        .concat(Object.keys(this.state.languageNames))
                        .filter(function(code) {
                            return this.blacklist.indexOf(code) == -1;
                        }, this),
                    fnFormatResult: this.onLangAutocomplete.bind(this),
                    onSelect: this.onLangCompleteSelect.bind(this)
                });
        },
        onLangAutocomplete: function(value) {
            console.log(value);
            return this.getLanguageFromCode(value) || value;
        },
        onLangFilterBlur: function() {
            if (!this.state.filter.typing) return;
            this.state.filter.typing = false;

            this.replaceListingFilter();
        },
        onLangFilterKeyup: function(e) {
            if (e.keyCode == 13) {
                this.onLangCompleteSelect(e.target.value);
            }
        },
        onLangCompleteSelect: function(value) {
            this.state.filter.typing = false;

            var code = this.state.languageNames[value] || value;
            if (this.getLanguageFromCode(code) && this.state.filter.langs.indexOf(code) == -1) {
                this.state.filter.langs.push(code);
            }

            this.replaceListingFilter();
            this.replaceListingList();
        },
        onRemoveLangFilter: function(lang) {
            this.state.filter.langs.splice(this.state.filter.langs.indexOf(lang), 1);

            this.replaceListingFilter();
            this.replaceListingList();
        },
        replaceListingFilter: function() {
            $('.I18nEdit-listingFilter').replaceWith(dev.ui(this.buildPageListingFilter()));
        },
        filterElementList: function(page) {
            if (this.state.filter.search) {
                var lcs = this.state.filter.search.toLowerCase();
                if (page.name.toLowerCase().indexOf(lcs) == -1) {
                    return false;
                }
            }

            if (this.state.filter.langs.length && page.json) {
                var found = false,
                i = this.state.filter.langs.length;

                page.filter = {
                    missing: [],
                    incomplete: []
                };

                while (i--) {
                    var code = this.state.filter.langs[i];
                    if (!page.json.hasOwnProperty(code)) {
                        page.filter.missing.push(code);
                        found = true;
                    } else if (Object.keys(page.json.en).length != Object.keys(page.json[code]).length) {
                        page.filter.incomplete.push(code);
                        found = true;
                    }
                }

                if (!found) return false;
            }

            return true;
        },
        filterListingSearch: function(e) {
            this.state.filter.search = e.target.value;
            this.replaceListingList();
        },
        replaceListingList: function() {
            $('.I18nEdit-pageListingList').replaceWith(dev.ui(this.buildPageListingList()));
        },
        replaceBreadcrumbs: function() {

        },
        listAll: function(params, query) {
            $.extend(params, {
                action: 'query'
            });

            return this.api.get(params).then(function(result) {
                if (query) {
                    for (var key in query) {
                        result.query[key] = (result.query[key] || []).concat(query[key]);
                    }
                }

                if (result['query-continue']) {
                    for (var key in result['query-continue']) {
                        $.extend(params, result['query-continue'][key]);
                    }
                    return this.listAll(params, result.query);
                }

                return result;
            }.bind(this));
        },
        cleanComments: function(str) {
            return str.trim().replace(/\/\*.+?\*\/$/gm, '');
        },
        getCurrentPageI18n: function(force) {
            var name = this.state.page,
            page = this.state.i18nPages[name];
            if (page && page.final && !force) return;

            return this.getJsonContent(this.pageToTitle(this.state.page))
                .then(this.onLoadedPageJson.bind(this, this.state.page));
        },
        onLoadedPageJson: function(name, str) {
            var json = JSON.parse(this.cleanComments(str));
            this.state.i18nPages[name] = {
                json: json,
                name: name,
                ns: 8,
                title: this.pageToTitle(name),
                final: true,
                pageid: null // hopefully we won't need this >_>
            };

            this.rebuildUI();
        },
        getAllI18nPages: function() {
            if (this.state.i18nPageList) return;
            this.listAll({
                list: 'allpages',
                apnamespace: 8,
                apprefix: 'Custom-',
                aplimit: 'max'
            })
            .then(this.mapWithContent.bind(this))
            .then(this.onLoadedI18n.bind(this));
        },
        // If titles is a string, it won't minify
        // This is because minification is !!!UNSAFE!!!
        // Seriously, strings can change, be careful with it
        getJsonContent: function(titles) {
            // Post request to get by the URI length limit
            return $.post(this.wg.wgLoadScript, {
                mode: 'articles',
                only: 'styles',
                articles: typeof titles == 'string'
                    ? titles
                    : titles.join('|'),
                debug: typeof titles == 'string' ? 1 : 0
            });
        },
        mapWithContent: function(query) {
            var allpages = query.query.allpages.filter(function(page) {
                return page.title.slice(-10) == '/i18n.json';
            }),
            titles = allpages.map(function(page) {
                return page.title;
            });

            this.onLoadedI18n(allpages);

            // TODO: Takes about 2 seconds on my internet; make lazy
            // Nvm, made lazy already on the line above; that was easy
            return this.getJsonContent(titles).then(function(json) {
                console.time('parsing');
                window.jsn = json;
                var i1 = jsn.indexOf('{'),
                i2 = jsn.indexOf('}'),
                iq = jsn.indexOf('"'),
                startIndex = 0,
                opened = 0,
                quoting = false,
                objects = [];

                while (i1 + i2 + iq !== -3) {
                    var min = i1;

                    if (min == -1 || i2 < min && i2 != -1) {
                        min = i2;
                    }

                    if (min == -1 || iq < min && iq != -1) {
                        min = iq;
                    }

                    if (min == -1) {
                        break;
                    }

                    switch (min) {
                        case i1:
                            var idx = i1;
                            i1 = jsn.indexOf('{', i1 + 1);
                            if (quoting) {
                                // console.log('broken {');
                                break;
                            }
                            if (opened === 0) {
                                startIndex = idx;
                            }
                            opened++;
                            break;
                        case i2:
                            var idx = i2;
                            i2 = jsn.indexOf('}', i2 + 1);
                            if (quoting) {
                                // console.log('broken }');
                                break;
                            }
                            opened--;
                            if (opened < 0) {
                                console.log('wtf', startIndex, idx);
                            }
                            if (opened === 0) {
                                var slice = json.slice(startIndex, idx + 1);
                                // console.log('Closed');
                                objects.push(JSON.parse(slice));
                            }
                            break;
                        case iq:
                            iq = jsn.indexOf('"', iq + 1);
                            if (jsn.charAt(iq - 1) != '\\' || jsn.charAt(iq - 2) == '\\') {
                                quoting = !quoting;
                            }
                            break;
                    }
                }

                console.timeEnd('parsing');

                // var split = jsn.split(/}}\s*{/);
                // split[0] = split[0].slice(1);
                // split[split.length - 1] = this.cleanComments(split[split.length - 1]).slice(0, -6);

                objects.forEach(function(obj, i) {
                    allpages[i].json = obj;
                });

                return allpages;
            }.bind(this));
        },
        onLoadedI18n: function(allpages) {
            this.state.i18nPageList = allpages
                .filter(function(page) {
                    return page.title.slice(-10) == '/i18n.json';
                })
                .map(function(page) {
                    page.name = page.title.slice(17, -10);
                    return page;
                });


            this.state.i18nPageList.forEach(function(page) {
                this.state.i18nPages[page.name] = page;
            }, this);

            // TODO: Decide whether this should call buildUI on other routes
            this.replaceListingList();
        },
        setEditButtons: function(buttons) {
            var $wrapper = $('#PageHeader').find('.page-header__contribution-buttons');
            $wrapper.empty();
            if (buttons) {
                buttons.main = buttons.main || {};
                buttons.buttons = buttons.buttons || [];
                $wrapper.append(dev.ui({
                    type: 'div',
                    classes: ['wds-button-group', 'I18nEdit-editButtonMock'],
                    children: [
                        $.extend(buttons.main, {
                            type: 'a',
                            classes: ['wds-button'].concat(buttons.main.classes || []),
                            text: null,
                            children: [
                                this.wds.icon(buttons.main.icon),
                                {
                                    type: 'span',
                                    text: buttons.main.text
                                }
                            ],
                            events: buttons.main.events,
                            condition: buttons.main.text,
                        }),
                        {
                            type: 'div',
                            classes: ['wds-dropdown'],
                            condition: buttons.buttons.length,
                            children: [
                                {
                                    type: 'div',
                                    classes: ['wds-button', 'wds-dropdown__toggle'],
                                    children: [
                                        this.wds.icon('dropdown-tiny')
                                    ]
                                },
                                {
                                    type: 'div',
                                    classes: ['wds-dropdown__content', 'wds-is-not-scrollable', 'wds-is-right-aligned'],
                                    children: [
                                        {
                                            type: 'ul',
                                            classes: ['wds-list', 'wds-is-linked'],
                                            children: buttons.buttons.map(this.buildDropdownButton.bind(this))
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }));
            }
        },
        buildDropdownButton: function(button) {
            return {
                type: 'li',
                classes: ['I18nEdit-dropdownButton'],
                children: [
                    $.extend(button, {
                        type: 'a'
                    })
                ]
            };
        },
        setContent: function(ui) {
            $('#mw-content-text').empty().append(dev.ui(ui));
        },
        setTitle: function(msg) {
            $('.page-header__title, #firstHeading').text(this.i18n.msg(msg + '-title').plain());

            document.title = this.i18n.msg('document-title',
                this.i18n.msg('title-' + msg, this.state.page, this.state.lang).plain(),
                this.wg.wgSiteName
            );
            document.title = 'I18nEdit | ' + this.i18n.msg('title-' + msg, this.page, this.lang).plain();
        },
        fadeInOut: function(transition) {
            // TODO: Fade content out, execute transition, then fade in
        },
        fetchLanguages: function() {
            this.api.get({
                action: 'query',
                meta: 'siteinfo',
                siprop: 'languages'
            }).then(this.onLoadedLanguages.bind(this));
        },
        onLoadedLanguages: function(query) {
            query.query.languages
                .filter(function(el) {
                    // TODO(Doru): Remove this, the filter should be anywhere where the UI lets you translate it.
                    // Since this only stores get data, and zh-hant is implemented anyways in some json pages, it's better to keep
                    return true;
                    // return this.blacklist.indexOf(el.code) == -1;
                }, this)
                .forEach(function(el) {
                    // if (!this.state.languageNames[el['*']]) {
                    this.state.languageNames[el['*']] = el.code;
                    // }
                    // if (!this.state.codes[el.code]) {
                    this.state.codes[el.code] = el['*'];
                    // }
                }, this);
            this.onload('sitelangs');
        },
        init: function() {
            this.readPath(location.pathname);

            this.bindEvents();

            this.buildUI();
        },
        // Abstract settings loading, even though its completely sync atm
        // TODO(Doru): No promises on not using promises, deferreds are ugly
        loadSettings: function() {
            return $.Deferred(function(def) {
                var langs = JSON.parse(localStorage.getItem('I18nEdit-langs'));
                def.resolve({
                    langs: langs
                });
            });
        },
        // Abstract saving settings, same as above
        saveSettings: function() {
            return $.Deferred(function(def) {
                localStorage.setItem('I18nEdit-langs', JSON.stringify(this.state.userLangs));
                def.resolve(true);
            }.bind(this));
        },
        importResources: function() {
            mw.hook('dev.ui').add(this.onload.bind(this, 'ui'));
            mw.hook('dev.wds').add(this.onload.bind(this, 'wds'));
            mw.hook('dev.i18n').add(this.onload.bind(this, 'i18n'));
            mw.loader.using('mediawiki.api').then(this.onload.bind(this, 'api'));
            mw.loader.using('jquery.autocomplete').done(this.onload.bind(this, 'autocomplete'));
            require(['ext.wikia.design-system.loading-spinner'], this.onload.bind(this, 'spinner'));
            this.loadSettings().then(this.onload.bind(this, 'settings'));

            importArticles({
                type: 'script',
                articles: [
                    'u:dev:MediaWiki:I18n-js/code.js',
                    'u:dev:MediaWiki:UI-js/code.js',
                    'u:dev:MediaWiki:WDSIcons/code.js'
                ]
            });

            var style = importArticle({
                type: 'style',
                article: 'u:dev:MediaWiki:I18nEdit.css'
            })[0];

            if (style) {
                style.onload = this.onload.bind(this, 'styles');
            } else {
                this.onload('styles');
            }
        },
        // TODO(Doru): REMOVE IN PRODUCTION
        implementShittyApiThatSometimesFailsToLoad: function() {
            mw.loader.implement("mediawiki.api", function($) {
                (function($, mw, undefined) {
                    var defaultOptions = {
                        parameters: {
                            action: 'query',
                            format: 'json'
                        },
                        ajax: {
                            url: mw.util.wikiScript('api'),
                            ok: function() {},
                            err: function(code, result) {
                                mw.log('mw.Api error: ' + code, 'debug');
                            },
                            timeout: 30000,
                            dataType: 'json'
                        }
                    };
                    mw.Api = function(options) {
                        if (options === undefined) {
                            options = {};
                        }
                        if (options.ajax && options.ajax.url !== undefined) {
                            options.ajax.url = String(options.ajax.url);
                        }
                        options.parameters = $.extend({}, defaultOptions.parameters, options.parameters);
                        options.ajax = $.extend({}, defaultOptions.ajax, options.ajax);
                        this.defaults = options;
                    }
                    ;
                    mw.Api.prototype = {
                        normalizeAjaxOptions: function(arg) {
                            var opt = arg || {};
                            if (typeof arg === 'function') {
                                opt = {
                                    'ok': arg
                                };
                            }
                            return opt;
                        },
                        get: function(parameters, ajaxOptions) {
                            ajaxOptions = this.normalizeAjaxOptions(ajaxOptions);
                            ajaxOptions.type = 'GET';
                            return this.ajax(parameters, ajaxOptions);
                        },
                        post: function(parameters, ajaxOptions) {
                            ajaxOptions = this.normalizeAjaxOptions(ajaxOptions);
                            ajaxOptions.type = 'POST';
                            return this.ajax(parameters, ajaxOptions);
                        },
                        ajax: function(parameters, ajaxOptions) {
                            parameters = $.extend({}, this.defaults.parameters, parameters);
                            ajaxOptions = $.extend({}, this.defaults.ajax, ajaxOptions);
                            ajaxOptions.data = $.param(parameters).replace(/\./g, '%2E');
                            ajaxOptions.error = function(xhr, textStatus, exception) {
                                ajaxOptions.err('http', {
                                    xhr: xhr,
                                    textStatus: textStatus,
                                    exception: exception
                                });
                            }
                            ;
                            ajaxOptions.success = function(result) {
                                if (result === undefined || result === null || result === '') {
                                    ajaxOptions.err('ok-but-empty', 'OK response but empty result (check HTTP headers?)');
                                } else if (result.error) {
                                    var code = result.error.code === undefined ? 'unknown' : result.error.code;
                                    ajaxOptions.err(code, result);
                                } else {
                                    ajaxOptions.ok(result);
                                }
                            }
                            ;
                            return $.ajax(ajaxOptions);
                        }
                    };
                    mw.Api.errors = ['ok-but-empty', 'timeout', 'duplicate', 'duplicate-archive', 'noimageinfo', 'uploaddisabled', 'nomodule', 'mustbeposted', 'badaccess-groups', 'stashfailed', 'missingresult', 'missingparam', 'invalid-file-key', 'copyuploaddisabled', 'mustbeloggedin', 'empty-file', 'file-too-large', 'filetype-missing', 'filetype-banned', 'filename-tooshort', 'illegal-filename', 'verification-error', 'hookaborted', 'unknown-error', 'internal-error', 'overwrite', 'badtoken', 'fetchfileerror', 'fileexists-shared-forbidden', 'invalidtitle', 'notloggedin'];
                    mw.Api.warnings = ['duplicate', 'exists'];
                }
                )(jQuery, mediaWiki);
            }, {}, {});
        }
        // TODO: Get rid of this stray object
    }, {} || window.I18nEdit);

    if (!I18nEdit.shouldRun()) return;

    I18nEdit.importResources();

    // TODO: Make a fancy export and import button for offline editing
})();

mw.util.addCSS(`.I18nEdit-listingFilter legend:active {
    margin-left: 4px;
}

.I18nEdit-listingFilter legend {
    user-select: none;
    transition: margin-left 100ms ease;
}

.I18nEdit-input {
    outline: none;
}

.I18nEdit-listingFilterTitleInput {
    width: 240px;
    font-size: 16px;
}

.I18nEdit-hoverableListElement {
    padding: 8px;
    border-bottom: 1px solid #ccc;
    cursor: pointer;
    transition: padding 200ms ease;
    overflow: hidden;
}

.I18nEdit-hoverableListElement:last-of-type {
    border-color: transparent;
}

.I18nEdit-hoverableListElement:hover,
.I18nEdit-selectedListElement {
    padding-left: 12px;
}

.I18nEdit-details {
    font-size: 12px;
    color: #ccc;
}

.I18nEdit-listingFilterLanguages {
    padding: 16px 0 0 0;
}

.I18nEdit-listingFilterLanguageChip {
    padding: 8px 0 8px 8px;
    margin-right: 4px;
    background-color: rgba(0, 0, 0, .1);
    border-radius: 18px;
    font-size: 12px;
    cursor: pointer;
}

.I18nEdit-listingFilterAddLanguage {
    padding-left: 0;
    padding-right: 8px;
}

.I18nEdit-listingFilterAddLanguage::before {
    content: '➕';
    padding: 4px;
    margin-right: 4px;
    margin-left: 4px;
    border-radius: 18px;
    transition: background-color 200ms ease;
    background-color: transparent;
}

.I18nEdit-listingFilterAddLanguage:hover::before {
    background-color: rgba(0, 0, 0, .05);
}

.I18nEdit-listingFilter .autocomplete {
    overflow: hidden;
}

.I18nEdit-listingFilterChipClose {
    border-radius: 50%;
    padding: 6px;
    display: inline-flex;
    height: 10px;
    margin-right: 4px;
    margin-left: 4px;
    transition: background-color 200ms ease;
    background-color: transparent;
}

.I18nEdit-listingFilterLanguageChip:hover .I18nEdit-listingFilterChipClose {
    background-color: rgba(0, 0, 0, .05);
}

.I18nEdit-listingFilterChipClose::after {
    content: '✖';
    font-weight: bold;
    font-family: monospace;
    line-height: 12px;
}

.I18nEdit-listingFilterAddingLanguageInput {
    border: none;
    background-color: transparent;
    border-radius: 4px;
    display: inline-flex;
    width: 120px;
    margin-right: 8px;
    outline: none;
    padding: 2px;
    font-size: 12px;
}

/* Tweak autocomplete position */
.I18nEdit-listingFilter .autocomplete-container {
    margin-top: 12px;
}

/* Language picker styles */
.I18nEdit-pickerContent {
    display: flex;
}

.I18nEdit-pickerColumn {
    flex: 1;
    padding: 8px;
}

/** List element styles **/
.I18nEdit-hoverableListElement {
    position: relative;
    overflow: visible;
}

.I18nEdit-hoverableListElement::after {
    content: '';
    display: block;
    position: absolute;
    background: #00d7ff;
    height: 2px;
    bottom: -1px;
    z-index: 10;
    visibility: hidden;
    right: 50%;
    left: 50%;
    transition: all 200ms ease;
}

.I18nEdit-selectedListElement::after {
    visibility: visible;
    left: 0;
    right: 0;
}

/** Search function **/
.I18nEdit-pickerToSearch {
    padding: 8px 12px;
}

.I18nEdit-pickerSearch {
    width: 100%;
    padding: 2px;
}

/* Edit buttons */
.I18nEdit-dropdownButton {
    cursor: pointer;
}`);
