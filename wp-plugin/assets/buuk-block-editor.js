/**
 * Minimal Gutenberg block registration for the Buuk Booking Widget.
 * The actual rendering is handled server-side by buuk_booking_shortcode().
 */
(function (blocks, element, blockEditor) {
    var el = element.createElement;
    var useBlockProps = blockEditor.useBlockProps;

    blocks.registerBlockType('buuk/booking-widget', {
        title: 'Buuk Booking Widget',
        icon: 'calendar-alt',
        category: 'widgets',
        description: 'Embed the Buuk online booking widget.',
        supports: { html: false },

        edit: function () {
            var blockProps = useBlockProps({
                style: {
                    background: '#f9f9f9',
                    border: '2px dashed #ccc',
                    padding: '24px',
                    textAlign: 'center',
                    borderRadius: '8px',
                },
            });
            return el(
                'div',
                blockProps,
                el('span', { style: { fontSize: '2em' } }, '📅'),
                el('p', { style: { margin: '8px 0 0', fontWeight: 600 } }, 'Buuk Booking Widget'),
                el('p', { style: { margin: '4px 0 0', color: '#666', fontSize: '13px' } }, 'Configure in Settings → Buuk Booking.')
            );
        },

        save: function () {
            // Server-side rendered via render_callback
            return null;
        },
    });
})(window.wp.blocks, window.wp.element, window.wp.blockEditor);
