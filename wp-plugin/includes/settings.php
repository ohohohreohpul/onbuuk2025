<?php
/**
 * Buuk Booking – WordPress admin settings page.
 *
 * Adds a "Buuk Booking" menu item under Settings in wp-admin.
 * The values entered here are passed to the React app via window.buukConfig.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// ---------------------------------------------------------------------------
// Register settings
// ---------------------------------------------------------------------------

function buuk_register_settings() {
    register_setting(
        'buuk_settings_group',
        'buuk_settings',
        array(
            'sanitize_callback' => 'buuk_sanitize_settings',
            'default'           => array(),
        )
    );

    add_settings_section(
        'buuk_main_section',
        __( 'Connection Settings', 'buuk-booking' ),
        'buuk_section_description',
        'buuk-booking'
    );

    add_settings_field(
        'supabase_url',
        __( 'Supabase Project URL', 'buuk-booking' ),
        'buuk_field_supabase_url',
        'buuk-booking',
        'buuk_main_section'
    );

    add_settings_field(
        'supabase_anon_key',
        __( 'Supabase Anon Key', 'buuk-booking' ),
        'buuk_field_supabase_anon_key',
        'buuk-booking',
        'buuk_main_section'
    );

    add_settings_field(
        'business_permalink',
        __( 'Business Permalink', 'buuk-booking' ),
        'buuk_field_business_permalink',
        'buuk-booking',
        'buuk_main_section'
    );

    // Booking page info (read-only, for reference)
    add_settings_section(
        'buuk_pages_section',
        __( 'Payment Return URLs', 'buuk-booking' ),
        'buuk_pages_section_description',
        'buuk-booking'
    );
}
add_action( 'admin_init', 'buuk_register_settings' );

// ---------------------------------------------------------------------------
// Sanitize
// ---------------------------------------------------------------------------

function buuk_sanitize_settings( $input ) {
    $clean = array();
    $clean['supabase_url']       = isset( $input['supabase_url'] )       ? esc_url_raw( trim( $input['supabase_url'] ) )       : '';
    $clean['supabase_anon_key']  = isset( $input['supabase_anon_key'] )  ? sanitize_text_field( trim( $input['supabase_anon_key'] ) )  : '';
    $clean['business_permalink'] = isset( $input['business_permalink'] ) ? sanitize_text_field( trim( $input['business_permalink'] ) ) : '';
    return $clean;
}

// ---------------------------------------------------------------------------
// Section callbacks
// ---------------------------------------------------------------------------

function buuk_section_description() {
    echo '<p>' . esc_html__( 'Enter your Buuk / Supabase project credentials. You can find these in your Supabase dashboard under Project Settings → API.', 'buuk-booking' ) . '</p>';
}

function buuk_pages_section_description() {
    $page_id = get_option( 'buuk_booking_page_id' );
    $page    = $page_id ? get_post( $page_id ) : null;
    $page_url = $page ? get_permalink( $page ) : site_url( '/book-now/' );

    echo '<p>';
    echo esc_html__( 'After a Stripe or PayPal payment, the customer is returned to your site. The booking widget reads the ', 'buuk-booking' );
    echo '<code>?buuk_mode</code> query parameter to show the correct screen.', '<br>';
    echo esc_html__( 'In your Buuk admin → Settings → Payment, set the following URLs:', 'buuk-booking' );
    echo '</p>';
    echo '<table class="form-table" role="presentation">';
    echo '<tr><th>' . esc_html__( 'Booking success URL', 'buuk-booking' ) . '</th>';
    echo '<td><code>' . esc_html( $page_url ) . '?buuk_mode=booking-success</code></td></tr>';
    echo '<tr><th>' . esc_html__( 'Gift-card success URL', 'buuk-booking' ) . '</th>';
    echo '<td><code>' . esc_html( $page_url ) . '?buuk_mode=gift-card-success</code></td></tr>';
    echo '<tr><th>' . esc_html__( 'Payment cancelled URL', 'buuk-booking' ) . '</th>';
    echo '<td><code>' . esc_html( $page_url ) . '?buuk_mode=payment-cancelled</code></td></tr>';
    echo '</table>';
}

// ---------------------------------------------------------------------------
// Field callbacks
// ---------------------------------------------------------------------------

function buuk_field_supabase_url() {
    $options = get_option( 'buuk_settings', array() );
    $value   = $options['supabase_url'] ?? '';
    printf(
        '<input type="url" name="buuk_settings[supabase_url]" value="%s" class="regular-text" placeholder="https://xxxxxxxxxxxx.supabase.co" />',
        esc_attr( $value )
    );
    echo '<p class="description">' . esc_html__( 'e.g. https://abcdefghij.supabase.co', 'buuk-booking' ) . '</p>';
}

function buuk_field_supabase_anon_key() {
    $options = get_option( 'buuk_settings', array() );
    $value   = $options['supabase_anon_key'] ?? '';
    printf(
        '<input type="text" name="buuk_settings[supabase_anon_key]" value="%s" class="large-text" autocomplete="off" />',
        esc_attr( $value )
    );
    echo '<p class="description">' . esc_html__( 'The public anon/service key — safe to expose in the browser.', 'buuk-booking' ) . '</p>';
}

function buuk_field_business_permalink() {
    $options = get_option( 'buuk_settings', array() );
    $value   = $options['business_permalink'] ?? '';
    printf(
        '<input type="text" name="buuk_settings[business_permalink]" value="%s" class="regular-text" placeholder="my-salon" />',
        esc_attr( $value )
    );
    echo '<p class="description">' . esc_html__( 'The permalink slug for your business as configured in Buuk admin → Settings → General.', 'buuk-booking' ) . '</p>';
}

// ---------------------------------------------------------------------------
// Admin menu
// ---------------------------------------------------------------------------

function buuk_add_settings_page() {
    add_options_page(
        __( 'Buuk Booking Settings', 'buuk-booking' ),
        __( 'Buuk Booking', 'buuk-booking' ),
        'manage_options',
        'buuk-booking',
        'buuk_render_settings_page'
    );
}
add_action( 'admin_menu', 'buuk_add_settings_page' );

// ---------------------------------------------------------------------------
// Settings page HTML
// ---------------------------------------------------------------------------

function buuk_render_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }
    ?>
    <div class="wrap">
        <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>

        <?php
        // Show the URL of the auto-created booking page
        $page_id = get_option( 'buuk_booking_page_id' );
        $page    = $page_id ? get_post( $page_id ) : null;
        if ( $page && $page->post_status === 'publish' ) {
            $edit_url = get_edit_post_link( $page_id );
            $view_url = get_permalink( $page_id );
            echo '<div class="notice notice-info"><p>';
            printf(
                /* translators: 1: view link, 2: edit link */
                esc_html__( 'Your booking page is live at %1$s. You can also %2$s.', 'buuk-booking' ),
                '<a href="' . esc_url( $view_url ) . '" target="_blank">' . esc_html( $view_url ) . '</a>',
                '<a href="' . esc_url( $edit_url ) . '">' . esc_html__( 'edit it', 'buuk-booking' ) . '</a>'
            );
            echo '</p></div>';
        }
        ?>

        <form method="post" action="options.php">
            <?php
            settings_fields( 'buuk_settings_group' );
            do_settings_sections( 'buuk-booking' );
            submit_button();
            ?>
        </form>
    </div>
    <?php
}
