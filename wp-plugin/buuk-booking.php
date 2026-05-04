<?php
/**
 * Plugin Name:       Buuk Booking
 * Plugin URI:        https://onbuuk.com
 * Description:       Embed the Buuk online booking widget on any page or post using the [buuk_booking] shortcode.
 * Version:           1.0.0
 * Requires at least: 5.9
 * Requires PHP:      7.4
 * Author:            Buuk
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       buuk-booking
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'BUUK_VERSION',    '1.0.0' );
define( 'BUUK_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'BUUK_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once BUUK_PLUGIN_DIR . 'includes/settings.php';

// ---------------------------------------------------------------------------
// Asset enqueueing
// ---------------------------------------------------------------------------

/**
 * Enqueue the React bundle only on pages/posts that contain the shortcode,
 * or if the query param ?buuk_mode is present (post-payment return pages).
 */
function buuk_enqueue_assets() {
    global $post;

    $has_shortcode = is_a( $post, 'WP_Post' ) && has_shortcode( $post->post_content, 'buuk_booking' );
    $is_return_page = isset( $_GET['buuk_mode'] );

    if ( ! $has_shortcode && ! $is_return_page ) {
        return;
    }

    $options = get_option( 'buuk_settings', array() );

    // CSS
    wp_enqueue_style(
        'buuk-booking',
        BUUK_PLUGIN_URL . 'assets/buuk-booking.css',
        array(),
        BUUK_VERSION
    );

    // JS (IIFE bundle — no module type needed)
    wp_enqueue_script(
        'buuk-booking',
        BUUK_PLUGIN_URL . 'assets/buuk-booking.js',
        array(),
        BUUK_VERSION,
        true // load in footer
    );

    // Pass settings to the React app via window.buukConfig
    wp_localize_script(
        'buuk-booking',
        'buukConfig',
        array(
            'supabaseUrl'      => sanitize_text_field( $options['supabase_url']       ?? '' ),
            'supabaseAnonKey'  => sanitize_text_field( $options['supabase_anon_key']  ?? '' ),
            'permalink'        => sanitize_text_field( $options['business_permalink']  ?? '' ),
        )
    );
}
add_action( 'wp_enqueue_scripts', 'buuk_enqueue_assets' );

// ---------------------------------------------------------------------------
// Shortcode: [buuk_booking]
// ---------------------------------------------------------------------------

/**
 * Renders the booking widget container.
 *
 * Attributes:
 *   (none currently required — config comes from the plugin settings page)
 *
 * Post-payment pages use URL query params instead of separate shortcodes:
 *   ?buuk_mode=booking-success
 *   ?buuk_mode=gift-card-success
 *   ?buuk_mode=payment-cancelled
 *   ?buuk_mode=cancel
 */
function buuk_booking_shortcode( $atts ) {
    // Determine which mode to display
    $mode = 'booking';
    if ( isset( $_GET['buuk_mode'] ) ) {
        $allowed = array( 'booking', 'cancel', 'booking-success', 'gift-card-success', 'payment-cancelled' );
        $raw     = sanitize_text_field( wp_unslash( $_GET['buuk_mode'] ) );
        if ( in_array( $raw, $allowed, true ) ) {
            $mode = $raw;
        }
    }

    return sprintf(
        '<div id="buuk-booking-widget" data-mode="%s" style="min-height:400px;"></div>',
        esc_attr( $mode )
    );
}
add_shortcode( 'buuk_booking', 'buuk_booking_shortcode' );

// ---------------------------------------------------------------------------
// Gutenberg block (simple wrapper around the shortcode)
// ---------------------------------------------------------------------------

function buuk_register_block() {
    if ( ! function_exists( 'register_block_type' ) ) {
        return;
    }

    register_block_type(
        'buuk/booking-widget',
        array(
            'editor_script'   => 'buuk-booking-block-editor',
            'render_callback' => 'buuk_booking_shortcode',
            'attributes'      => array(),
        )
    );

    wp_register_script(
        'buuk-booking-block-editor',
        BUUK_PLUGIN_URL . 'assets/buuk-block-editor.js',
        array( 'wp-blocks', 'wp-element', 'wp-block-editor' ),
        BUUK_VERSION,
        true
    );
}
add_action( 'init', 'buuk_register_block' );

// ---------------------------------------------------------------------------
// Activation: create a default "Book Now" page with the shortcode
// ---------------------------------------------------------------------------

function buuk_activate() {
    $existing = get_option( 'buuk_booking_page_id' );
    if ( $existing && get_post( $existing ) ) {
        return; // page already exists
    }

    $page_id = wp_insert_post( array(
        'post_title'   => 'Book Now',
        'post_content' => '[buuk_booking]',
        'post_status'  => 'publish',
        'post_type'    => 'page',
    ) );

    if ( ! is_wp_error( $page_id ) ) {
        update_option( 'buuk_booking_page_id', $page_id );
    }
}
register_activation_hook( __FILE__, 'buuk_activate' );
