/* CodeSelectAll
 *
 * Overrides the default behavior of ctrl+A of selecting the whole page
 * in MediaWiki JavaScript or CSS pages so that it only selects the content of the page
 * 
 * @author Dorumin
 */

(function() {
    if (
        mw.config.get('wgNamespaceNumber') != 8 ||
        !document.querySelector('.source-javascript, .source-css') ||
        window.CodeSelectAll
    ) return;

    window.CodeSelectAll = true;

    function select(el) {
        if (window.getSelection && document.createRange) {
            var sel = window.getSelection();
            var range = document.createRange();
            range.selectNodeContents(el);
            sel.removeAllRanges();
            sel.addRange(range);
        } else if (document.selection && document.body.createTextRange) {
            var textRange = document.body.createTextRange();
            textRange.moveToElementText(el);
            textRange.select();
        }
    }

    document.addEventListener('keydown', function(e) {
        if (e.which == 65 && e.ctrlKey) {
            e.preventDefault();
            select(document.querySelector('.source-javascript, .source-css'));
        }
    });
})();