/**
 * AjaxDelete
 *
 * Allows to delete pages (through ?action=delete links) without leaving the current page.
 * Supports deleting revisions and restoring pages (does not support restoring individual revisions)
 * For personal use
 * @author Dorumin
 * @author KockaAdmiralac
 */

(function() {
    if (window.AjaxDelete && window.AjaxDelete.loaded) return;

    window.AjaxDelete = $.extend({
        loaded: true,

        // Config options and defaults
        deleteReasons: {
            '[[w:Help:Vandalism|Vandalism]]': 'Vandalism',
            '[[w:Help:Spam|Spam]]': 'Spam',
            'Marked for speedy deletion': 'Speedy',
            'Empty page': 'Empty',
            'Author request': 'Author request',
            'Irrelevant to <insert wiki topic here>': 'Irrelevant',
            'Failed to comply with the [[Project:Manual of Style|manual of style]] for over 6 months': 'MoS'
        },
        imageDeleteReasons: {
            'Offensive': 'Offensive',
            'Inappropriate': 'Inappropriate',
            'Harassment': 'Harassment',
            'Housekeeping/Unused': 'Unused',
            'Copyright infringement': 'Copyright',
            'Author request': 'Author request'
        },
        autoCheckWatch: false,
        noUndelete: true,
        reload: true,

        // Globals
        wg: mw.config.get([
            'wgUserGroups',
            'wgNamespaceIds',
            'wgArticlePath',
            'wgContentLanguage',
            'wgFormattedNamespaces',
            'wgNamespaceNumber',
        ]),
        isUCP: parseFloat(mw.config.get('wgVersion')) > 1.19,
        currentModal: null,
        bannerModule: '',

        // Resource management
        loading: [
            'css',
            'api',
            'banners',
            'i18n',
            'i18n-js',
            'modal-js',
            'ui-js',
            'expiry-times',
            'block-reasons',
            'aliases'
        ],
        onload: function(key, arg) {
            switch (key) {
                case 'i18n-js':
                    var lib = arg;
                    lib.loadMessages('AjaxDelete').then(this.onload.bind(this, 'i18n'));
                    break;
                case 'i18n':
                    var i18n = arg;
                    this.i18n = i18n;
                    break;
                case 'api':
                    this.api = new mw.Api();
                    this.ensureBlockSelects();
                    this.loadSpecialPageAliases();
                    break;
                case 'banners':
                    var BannerNotification = arg;
                    this.BannerNotification = BannerNotification;
                    break;
            }

            var index = this.loading.indexOf(key);
            if (index === -1) throw new Error('Unregistered dependency loaded: ' + key);

            this.loading.splice(index, 1);

            if (this.loading.length !== 0) return;

            this.init();
        },
        canRun: function() {
            return this.hasRights([
                'sysop',
                'content-moderator',
                'content-volunteer',
                'staff',
                'helper',
                'wiki-manager',
                'content-team-member',
                'soap'
            ]);
        },
        hasRights: function(rights) {
            var len = rights.length;
            while (len--) {
                if (this.wg.wgUserGroups.indexOf(rights[len]) !== -1) return true;
            }

            return false;
        },
        preload: function() {
            // Styles
            var imported = importArticle({
                type: 'style',
                article: 'u:dev:MediaWiki:AjaxBlock.css'
            });

            if (this.isUCP) {
                imported.then(this.onload.bind(this, 'css'));
            } else {
                if (imported.length === 0) {
                    this.onload('css');
                } else {
                    imported[0].onload = this.onload.bind(this, 'css');
                }
            }

            // Dev libs
            importArticles({
                type: 'script',
                articles: [
                    'u:dev:MediaWiki:BannerNotification.js',
                    'u:dev:MediaWiki:Modal.js',
                    'u:dev:MediaWiki:I18n-js/code.js',
                    'u:dev:MediaWiki:UI-js/code.js',
                ]
            });

            mw.hook('dev.banners').add(this.onload.bind(this, 'banners-js'));
            mw.hook('dev.modal').add(this.onload.bind(this, 'modal-js'));
            mw.hook('dev.i18n').add(this.onload.bind(this, 'i18n-js'));
            mw.hook('dev.ui').add(this.onload.bind(this, 'ui-js'));

            // Loader modules
            mw.loader.using('mediawiki.api').then(this.onload.bind(this, 'api'));
        },

        // Functions
    }, window.AjaxDelete);

    if (!window.AjaxDelete.canRun()) return;

    window.AjaxDelete.preload();
})();
