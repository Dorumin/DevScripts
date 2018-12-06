/* DockedPrivateMessages
 *
 * Adds tabs at the bottom of the page where new PMs are added, and can be controlled independently from the private room
 * 
 * @author Dorumin
 */

(function() {
    if (
        mw.config.get('wgCanonicalSpecialPageName') != 'Chat' ||
        (window.DockedPrivateMessages && DockedPrivateMessages.init)
    ) return;

    window.DockedPrivateMessages = $.extend({
        _preload: 0,
        bindEvents: function(room) {

        },
        onPrivateRoom: function(user) {
            var roomId = user.attributes.roomId,
                room = mainRoom.chats.privates[roomId];
            if (this.dockOnOpen) {
                
            }
        },
        onPrivateClick: function(e) {

        },
        preload: function() {
            if (++this._preload == 3) {
                dev.i18n.loadMessages('DockedPrivateMessages').then(this.init.bind(this));
            }
        },
        init: function(i18n) {
            this.i18n = i18n;
            i18n.useUserLang();

            mainRoom.model.privateUsers.bind('add', this.onPrivateRoom.bind(this));
            mainRoom.viewUsers.bind('privateListClick', this.onPrivateClick.bind(this));


        }
    }, window.DockedPrivateMessages);

    importArticle({
        type: 'style',
        article: 'u:dev:MediaWiki:DockedPrivateMessages.css'
    });

    importArticles({
        type: 'script',
        articles: [
            'u:dev:MediaWiki:I18n-js/code.js',
            'u:dev:MediaWiki:UI-js/code.js',
            'u:dev:MediaWiki:Chat-js.js'
        ]
    });
    
    mw.hook('dev.ui').add(DockedPrivateMessages.preload.bind(DockedPrivateMessages));
    mw.hook('dev.i18n').add(DockedPrivateMessages.preload.bind(DockedPrivateMessages));
    mw.hook('dev.chat.render').add(DockedPrivateMessages.preload.bind(DockedPrivateMessages));
})();