/* ChainQuotes
 *
 * Lets you shift click thread "Quote" buttons to add the quote wikitext to the current editor instead of replacing
 * Yes, once again, it works with RTE. You still shouldn't use it tho
 * 
 * @author Dorumin
 */

mw.loader.using('mediawiki.util').then(function() {
    if (
        window.ChainQuotes && ChainQuotes.init
    ) return;

    window.ChainQuotes = $.extend({
        wall: $('#Wall').data('Wall'),
        getMode: function() {
            var editor = this.wall.replyMessageForm.editor;
            return editor && editor.data('wikiaEditor')
                ? window.WikiaEditor.modeToFormat(editor.data('wikiaEditor').mode)
                : 'wikitext';
        },
        getQuote: function(id) {
            return $.nirvana.sendRequest({
                controller: 'WallExternalController',
                method: 'getFormattedQuoteText',
                format: 'json',
                data: {
                    messageId: id,
                    convertToFormat: this.getMode()
                }
            });
        },
        addQuote: function(e) {
            this.getQuote($(e.target).closest('.message').data('id')).then(this.onQuote.bind(this));
            this.scrollToEditor();
        },
        onQuote: function(data) {
            this.appendToEditor('\n' + data.markup);
            this.scrollEditorToBottom();
        },
        appendToEditor: function(text) {
            var inst = WikiaEditor.getInstance();
            inst.setContent(inst.getContent() + text);
        },
        scrollToEditor: function() {
            $('body').scrollTo(WikiaEditor.getInstance().element.offset().top - innerHeight / 3, {
                duration: 600
            });
        },
        scrollEditorToBottom: function() {
            var inst = WikiaEditor.getInstance(),
            box = inst.getEditbox();
            if (box.prop('tagName').toLowerCase() !== 'textarea') {
                box = box.parent();
            }
            box.scrollTop(box.prop('scrollHeight'));
        },
        onClick: function(e) {
            if (!e.shiftKey || !this.wall.replyMessageForm.editor) return;
            e.stopImmediatePropagation();
            this.addQuote(e);
        },
        onPage: function() {
            $('.quote-button').click(this.onClick.bind(this));
        },
        init: function() {
            this.onPage(mw.util.$content);
            mw.hook('wikipage.content').add(this.onPage.bind(this));
            this.wall.pagination.on('afterPageLoaded', this.onPage.bind(this));
        }
    }, window.ChainQuotes);

    ChainQuotes.init();
});