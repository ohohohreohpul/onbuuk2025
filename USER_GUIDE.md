# Buuk - Complete Booking System User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Business Setup](#business-setup)
4. [Admin Panel Overview](#admin-panel-overview)
5. [Managing Services](#managing-services)
6. [Managing Specialists](#managing-specialists)
7. [Booking Management](#booking-management)
8. [Customer Management](#customer-management)
9. [Calendar & Scheduling](#calendar--scheduling)
10. [Customization & Branding](#customization--branding)
11. [Payment Settings](#payment-settings)
12. [Gift Cards](#gift-cards)
13. [Loyalty Program](#loyalty-program)
14. [Team & Staff Management](#team--staff-management)
15. [Email Notifications](#email-notifications)
16. [Customer Portal](#customer-portal)
17. [Advanced Features](#advanced-features)
18. [Troubleshooting](#troubleshooting)
19. [Best Practices](#best-practices)
20. [FAQ](#faq)

---

## Introduction

Welcome to **Buuk**, a comprehensive booking and appointment management system designed for service-based businesses. Whether you run a spa, salon, clinic, or consulting practice, Buuk provides everything you need to manage bookings, customers, staff, and payments.

### Key Features

- **Online Booking**: Customer-facing booking portal with customizable branding
- **Calendar Management**: Visual calendar with drag-and-drop functionality
- **Customer Database**: Track customer information, booking history, and notes
- **Multiple Specialists**: Manage teams with individual schedules and services
- **Payment Processing**: Integrated Stripe payments with deposits and no-show fees
- **Gift Cards**: Sell and manage digital gift cards
- **Loyalty Program**: Reward repeat customers with points and rewards
- **Email Notifications**: Automated booking confirmations and reminders
- **Custom Branding**: Full color and text customization
- **Multi-Language Support**: Booking flow available in multiple languages
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile

---

## Getting Started

### Initial Setup

1. **Create Your Account**
   - Visit the registration page
   - Enter your business email address
   - Choose a secure password
   - Select your pricing plan (Free, Standard, or Pro)

2. **Business Information**
   - Enter your business name
   - Select your business type (Spa, Salon, Clinic, etc.)
   - Add contact information (phone, email, address)
   - Upload your business logo
   - Set your time zone and currency

3. **First Login**
   - Access the admin panel at `/admin`
   - You'll see a profile completion banner guiding you through setup
   - Complete all required fields to unlock full features

### Quick Start Checklist

- [ ] Complete business profile
- [ ] Add at least one service
- [ ] Create specialist profiles
- [ ] Set working hours
- [ ] Configure payment settings
- [ ] Customize booking form colors
- [ ] Test the booking flow
- [ ] Send a test booking to yourself

---

## Business Setup

### Store Profile

Navigate to **Settings > Store Profile** to configure your business details:

#### Basic Information
- **Business Name**: Your official business name (displayed on booking pages)
- **Tagline**: Short description of your business
- **About**: Detailed description of your services and philosophy
- **Business Type**: Category (e.g., Spa & Wellness, Hair Salon, Medical Clinic)

#### Contact Information
- **Email**: Primary business email (used for notifications)
- **Phone**: Business phone number (displayed to customers)
- **Address**: Physical location (optional but recommended)
- **Website**: Your business website URL

#### Branding
- **Business Logo**: Main logo (recommended: 400x400px PNG with transparent background)
- **Login Page Logo**: Optional alternate logo for the admin login page
- **Favicon**: Browser tab icon (recommended: 32x32px or 64x64px)

#### Operating Settings
- **Time Zone**: Select your local time zone
- **Currency**: Choose your operating currency (USD, EUR, GBP, etc.)
- **Default Language**: Primary language for the booking system

#### Social Media & Online Presence
- **Permalink**: Your unique booking page URL (e.g., buuk.com/your-business)
- **Custom Domain**: Link your own domain (Pro feature)
- **Social Media Links**: Connect Instagram, Facebook, Twitter, etc.

---

## Admin Panel Overview

The admin panel is your command center for managing all aspects of your business.

### Dashboard

The dashboard provides a quick overview of your business performance:

- **Today's Bookings**: Number of appointments scheduled for today
- **This Week's Revenue**: Total revenue from confirmed bookings
- **Active Customers**: Total number of registered customers
- **Upcoming Appointments**: List of next bookings
- **Recent Activity**: Latest bookings, cancellations, and customer actions
- **Quick Stats**: Monthly comparison and growth metrics

### Navigation

The left sidebar provides access to all features:

- **Dashboard**: Overview and quick stats
- **Calendar**: Visual schedule management
- **Bookings**: List view of all appointments
- **Customers**: Customer database
- **Services**: Service catalog management
- **Specialists**: Staff profile management
- **Team**: Staff permissions and roles
- **Products**: Add-on products and retail items
- **Gift Cards**: Gift card sales and management
- **Loyalty**: Loyalty program settings
- **POS**: Point of sale for walk-in customers
- **Settings**: System configuration
- **Appearance**: Branding and customization

---

## Managing Services

Services are the core offerings your business provides to customers.

### Creating a Service

1. Navigate to **Services** in the admin panel
2. Click **"Add New Service"**
3. Fill in the service details:

#### Basic Information
- **Service Name**: Clear, descriptive name (e.g., "Deep Tissue Massage")
- **Category**: Organize services (e.g., Massages, Facials, Hair Services)
- **Description**: Detailed explanation of what's included
- **Price**: Base price for the service
- **Currency**: Select from configured currencies

#### Duration Options
- **Multiple Durations**: Offer different time lengths
  - Example: 30 min ($50), 60 min ($90), 90 min ($130)
- **Custom Pricing**: Each duration can have its own price
- **Default Duration**: Pre-selected option in booking flow

#### Advanced Settings
- **Deposit Required**: Collect partial payment upfront
  - Set deposit amount or percentage
  - Applied at booking time
- **No-Show Fee**: Charge for missed appointments
  - Penalty for customers who don't show up
  - Captured from saved payment method
- **Buffer Time**: Padding before/after appointments
  - **Before**: Preparation time (5-15 minutes)
  - **After**: Cleanup time (5-15 minutes)
  - Prevents back-to-back scheduling
- **Online Booking**: Enable/disable for online customers
- **Requires Specialist**: Assign to specific staff members

#### Specialist Assignment
- Select which team members can perform this service
- Specialists appear in the booking flow for customer selection
- Leave unassigned to allow any available specialist

### Managing Service Categories

Organize services into logical groups:

1. Click **"Manage Categories"**
2. Add new categories (e.g., "Massage Therapy", "Hair Services", "Skincare")
3. Drag and drop services to reorder within categories
4. Categories help customers find relevant services quickly

### Service Best Practices

- **Clear Names**: Use descriptive, customer-friendly names
- **Detailed Descriptions**: Include what's included, benefits, and expectations
- **Competitive Pricing**: Research local market rates
- **Accurate Durations**: Account for full service time including consultation
- **High-Quality Images**: Add photos to make services more appealing (if available)
- **Popular Tags**: Mark bestsellers to highlight them

---

## Managing Specialists

Specialists (also called staff, therapists, or service providers) are the professionals who deliver your services.

### Creating a Specialist Profile

1. Navigate to **Specialists**
2. Click **"Add Specialist"**
3. Configure the profile:

#### Basic Information
- **Full Name**: Specialist's professional name
- **Display Name**: Name shown to customers (can be nickname)
- **Title/Role**: Professional title (e.g., "Senior Therapist", "Master Stylist")
- **Bio**: Professional background, specialties, and experience
- **Profile Photo**: Professional headshot (recommended: 400x400px)

#### Contact & Login
- **Email**: Professional email address (optional)
- **Phone**: Direct contact number (optional)
- **Login Access**: Create admin account for the specialist
  - Allows them to view their own schedule
  - Can manage their assigned bookings

#### Service Assignments
- Select which services this specialist can perform
- Specialists only appear for their assigned services
- One specialist can offer multiple services

#### Availability
- **Active Status**: Enable/disable specialist in booking system
- **Working Hours**: Set custom schedule (or use business default)
- **Time Blocks**: Mark unavailable periods (lunch breaks, meetings, etc.)

### Working Hours Management

Set when each specialist is available for bookings:

1. Click **"Set Working Hours"** for a specialist
2. Configure each day of the week:
   - **Day Status**: Open or Closed
   - **Start Time**: When they start accepting appointments
   - **End Time**: Last possible appointment start time
   - **Multiple Shifts**: Add breaks or split schedules
3. **Copy to All Days**: Quickly apply same hours across the week
4. **Use Business Default**: Inherit the main business hours

**Example Schedule:**
```
Monday:    9:00 AM - 6:00 PM
Tuesday:   9:00 AM - 6:00 PM
Wednesday: 9:00 AM - 8:00 PM (late night)
Thursday:  9:00 AM - 6:00 PM
Friday:    9:00 AM - 6:00 PM
Saturday:  10:00 AM - 4:00 PM
Sunday:    Closed
```

### Time Blocks (Unavailable Periods)

Block time when specialists are unavailable:

1. Click **"Manage Time Blocks"**
2. Add time blocks:
   - **Daily Breaks**: Lunch, meetings (repeating)
   - **Vacation**: Out of office periods
   - **Personal Time**: Appointments, errands
   - **Training**: Professional development
3. Time blocks prevent customer bookings during these periods
4. Repeating vs. One-time blocks

**Common Time Blocks:**
- Lunch Break: 12:00 PM - 1:00 PM (daily)
- Team Meeting: Fridays 4:00 PM - 5:00 PM
- Vacation: December 24-31 (annual)

### Specialist Best Practices

- **Professional Photos**: Use high-quality, friendly headshots
- **Compelling Bios**: Highlight experience, certifications, specialties
- **Accurate Hours**: Keep schedules updated to prevent double-bookings
- **Service Expertise**: Only assign services they're qualified for
- **Regular Updates**: Review and update time blocks weekly

---

## Booking Management

Manage all appointments from the Bookings view.

### Viewing Bookings

Navigate to **Bookings** to see all appointments:

#### List View Features
- **Filter by Status**: All, Pending, Confirmed, Completed, Cancelled
- **Filter by Date**: Today, This Week, This Month, Custom Range
- **Filter by Specialist**: View specific team member's bookings
- **Search**: Find bookings by customer name, email, or booking ID

#### Booking Information
Each booking displays:
- **Customer Name** and contact information
- **Service** and duration selected
- **Specialist** assigned (or "Any Available")
- **Date & Time** of appointment
- **Status**: Current booking state
- **Payment Status**: Paid, Pending, Refunded
- **Total Price**: Including any add-ons or gift card discounts
- **Notes**: Customer requests or internal notes

### Booking Statuses

- **Pending**: Awaiting confirmation or payment
- **Confirmed**: Approved and scheduled
- **Completed**: Service delivered successfully
- **Cancelled**: Booking was cancelled by customer or admin
- **No-Show**: Customer didn't arrive for appointment

### Managing Individual Bookings

Click any booking to view full details and take actions:

#### Available Actions
- **Confirm Booking**: Approve pending bookings
- **Reschedule**: Change date/time
- **Reassign Specialist**: Change assigned staff member
- **Mark Complete**: After service is delivered
- **Mark No-Show**: Customer didn't arrive
- **Cancel**: Cancel the appointment
- **Refund**: Process payment refund (if applicable)
- **Send Reminder**: Manual reminder email
- **Add Notes**: Internal notes (not visible to customer)

#### Editing Booking Details
- Change service or duration
- Modify date and time
- Update customer information
- Add or remove add-on products
- Apply gift card balance
- Adjust pricing

### Creating Manual Bookings

Create bookings on behalf of customers (walk-ins, phone bookings):

1. Click **"Create Booking"** button
2. Fill in the booking details:
   - **Customer**: Select existing or create new
   - **Service**: Choose from available services
   - **Duration**: Select time length
   - **Specialist**: Assign or leave as "Any Available"
   - **Date & Time**: Pick from available slots
   - **Add-ons**: Optional products (optional)
   - **Notes**: Special requests or information
   - **Payment**: Mark as paid or pending
3. Click **"Create Booking"**

### Bulk Actions

Select multiple bookings to perform batch operations:

- **Bulk Confirm**: Confirm multiple pending bookings
- **Bulk Email**: Send custom message to selected customers
- **Bulk Cancel**: Cancel multiple appointments (with refund option)
- **Export**: Download booking data as CSV

### Cancellation & Refund Policy

Configure your cancellation policy in **Settings > General**:

- **Cancellation Window**: Minimum hours before appointment (e.g., 24 hours)
- **Automatic Refunds**: Enable/disable automatic refund processing
- **Cancellation Fee**: Charge a fee for late cancellations
- **No-Show Penalty**: Charge full or partial amount for missed appointments

---

## Customer Management

Build and manage your customer database.

### Customer Profiles

Each customer profile includes:

#### Basic Information
- **Full Name**: Customer's name
- **Email**: Primary contact email
- **Phone**: Contact number
- **Date of Birth**: For birthday promotions (optional)
- **Profile Photo**: Avatar (if uploaded)

#### Booking History
- **Total Bookings**: Lifetime appointment count
- **Completed**: Successfully delivered services
- **Cancelled**: Appointment cancellations
- **No-Shows**: Missed appointments
- **Total Spent**: Lifetime revenue from this customer
- **Average Booking Value**: Spending per visit

#### Loyalty Information
- **Points Balance**: Current loyalty points
- **Points Earned**: Total points accumulated
- **Points Redeemed**: Points used for rewards
- **Tier Level**: VIP, Gold, Silver, etc. (if applicable)

#### Gift Cards
- **Active Gift Cards**: Available balance
- **Gift Card History**: Purchases and redemptions

#### Communication Preferences
- **Email Notifications**: Opt-in status
- **SMS Notifications**: Opt-in status (if enabled)
- **Marketing Emails**: Promotional email consent
- **Preferred Language**: Communication language

### Adding Customer Notes

Keep track of important information:

1. Open customer profile
2. Scroll to **"Notes"** section
3. Add notes:
   - Allergies or sensitivities
   - Service preferences
   - Special requests
   - Important dates (anniversary, etc.)
   - Previous issues or complaints
4. Notes are private and only visible to staff

**Example Notes:**
- "Allergic to lavender oil"
- "Prefers firm pressure massage"
- "Usually books on Saturdays"
- "Sensitive to noise - prefer quiet room"

### Customer Tags & Segments

Organize customers with tags:

- **VIP**: High-value customers
- **New**: First-time visitors
- **Returning**: Repeat customers
- **At Risk**: Haven't booked recently
- **Local**: Lives nearby
- **Tourist**: Visiting from out of town

Use segments for targeted marketing:
- Send special offers to VIP customers
- Welcome emails for new customers
- Win-back campaigns for at-risk customers

### Exporting Customer Data

Export customer information for analysis or marketing:

1. Navigate to **Customers**
2. Click **"Export"**
3. Choose format: CSV or Excel
4. Select data fields to include
5. Download file

---

## Calendar & Scheduling

Visual calendar view for managing appointments and availability.

### Calendar Views

Switch between different calendar views:

- **Day View**: Hour-by-hour schedule for single day
- **Week View**: 7-day overview with all specialists
- **Month View**: High-level monthly view
- **Specialist View**: Individual specialist calendars side-by-side

### Calendar Features

#### Drag and Drop
- **Move Appointments**: Drag bookings to new time slots
- **Reschedule**: Drop on different day/time
- **Reassign**: Drag to different specialist's column
- **Visual Feedback**: Real-time validation of available slots

#### Color Coding
Bookings are color-coded by status:
- **Blue**: Confirmed appointments
- **Yellow**: Pending bookings (awaiting confirmation)
- **Green**: Completed appointments
- **Red**: Cancelled bookings
- **Orange**: No-shows
- **Gray**: Blocked time / unavailable

#### Quick Actions
Click any appointment for quick actions:
- View full details
- Check-in customer (mark as arrived)
- Start service
- Complete appointment
- Add notes
- Send message to customer

### Availability Management

#### Business Hours
Set your default operating hours:

1. Go to **Settings > General**
2. Click **"Working Hours"**
3. Configure each day:
   - Open/Closed status
   - Opening time
   - Closing time
   - Break times
4. Save changes

#### Blocked Time
Create blocked time directly from calendar:

1. Click on time slot
2. Select **"Block Time"**
3. Choose:
   - Start and end time
   - Reason (meeting, lunch, maintenance)
   - Applies to: All specialists or specific person
   - Repeat: One-time or recurring

#### Holiday Closures
Mark business closure for holidays:

1. Go to **Settings > General > Holidays**
2. Add closure dates:
   - Holiday name
   - Start date
   - End date
   - Closure reason (optional public message)
3. System automatically blocks all bookings during closure

**Common Holidays to Block:**
- New Year's Day
- Christmas Day
- Thanksgiving
- Independence Day
- Business anniversary

### Appointment Conflicts

The system prevents double-booking:

- **Red Border**: Slot conflicts with existing booking
- **Gray Out**: Time outside business hours
- **Warning Icon**: Specialist unavailable (time block)
- **Buffer Indicator**: Within buffer time of another booking

---

## Customization & Branding

Make the booking experience match your brand identity.

### Booking Form Appearance

Navigate to **Settings > Booking Form Appearance** to customize your booking flow.

#### Color Customization

##### Brand Colors
Define your primary brand colors:

- **Primary Color**: Main brand color for buttons and key actions
  - Default: `#008374` (Teal)
  - Used for: Primary buttons, links, progress indicators

- **Primary Hover**: Color when hovering over primary elements
  - Default: `#006b5e` (Darker teal)
  - Used for: Button hover states

- **Secondary Color**: Supporting brand color
  - Default: `#89BA16` (Green)
  - Used for: Secondary buttons, alternative actions

- **Secondary Hover**: Secondary button hover state
  - Default: `#72970f` (Darker green)

- **Accent Color**: Highlight color for special elements
  - Default: `#89BA16` (Green)
  - Used for: Badges, notifications, special callouts

##### Text Colors
Control text readability:

- **Primary Text**: Main text color for headings and important content
  - Default: `#171717` (Near black)

- **Secondary Text**: Lighter text for descriptions and subtitles
  - Default: `#737373` (Gray)

##### Backgrounds & Borders
Set background and divider colors:

- **Background**: Main background color
  - Default: `#ffffff` (White)

- **Secondary Background**: Background for cards and sections
  - Default: `#f5f5f5` (Light gray)

- **Border Color**: Lines, dividers, and input outlines
  - Default: `#e5e5e5` (Medium gray)

#### Using the Color Picker

1. **Select a Color**: Click the color category you want to change
2. **Choose Method**:
   - **Color Swatch**: Click the color box to open native color picker
   - **Hex Input**: Type hex code directly (e.g., `#008374`)
3. **Live Preview**: Toggle "Live Preview" to see changes in real-time
4. **Save**: Click "Save Colors" to persist changes

#### Reset to Defaults

Made changes you don't like?
1. Click **"Reset"** button
2. Confirm the action
3. All colors revert to default brand palette

#### Text Customization

Customize the text on each step of the booking flow:

##### Welcome Page
- **Title**: Main headline (default: "Book Your Appointment")
- **Subtitle**: Supporting text
- **Description**: Detailed intro paragraph
- **Button Text**: Call-to-action button text

##### Service Selection
- **Title**: Page heading
- **Subtitle**: Instructions or description
- **Service Cards**: Individual service descriptions

##### Duration Selection
- **Title**: Page heading
- **Subtitle**: Guidance text

##### Specialist Selection
- **Title**: Page heading
- **Subtitle**: Instructions
- **Any Available Text**: Text for "any specialist" option
- **Specialist Bios**: Individual specialist descriptions

##### Date & Time
- **Title**: Page heading
- **Subtitle**: Instructions for selecting date/time

##### Personal Details
- **Title**: Page heading
- **Subtitle**: Instructions for form completion
- **Field Labels**: Customize form field names

##### Review & Payment
- **Title**: Page heading
- **Subtitle**: Review instructions
- **Cancellation Policy**: Your cancellation terms
- **Privacy Policy**: Link and text

#### Image Customization

Upload custom images for each booking step:

1. Go to **Settings > Booking Form Appearance > Images**
2. Choose booking step
3. Upload image:
   - **Recommended Size**: 800x1200px (portrait)
   - **Format**: JPG or PNG
   - **Max Size**: 5MB
   - **Aspect Ratio**: 2:3 or similar portrait
4. **Default Image**: Upload one image to use across all steps
5. **Step-Specific**: Override default with step-specific images

**Image Tips:**
- Use high-quality professional photos
- Show your space, services, or team
- Ensure good lighting and composition
- Avoid text overlays (use actual text fields instead)
- Represent your brand aesthetic

### Booking Layout Options

Choose how booking information is displayed:

- **Default Layout**: Single column, step-by-step
- **Minimal Layout**: Streamlined, essential info only
- **Split Panel Layout**: Form on left, info on right
- **Vertical Layout**: All information in vertical scroll

Navigate to **Settings > General > Booking Layout** to change.

### Custom Domain (Pro Feature)

Use your own domain for the booking page:

1. Go to **Settings > Custom Domain**
2. Enter your domain (e.g., `book.yourbusiness.com`)
3. Follow DNS configuration instructions
4. Verify domain ownership
5. SSL certificate automatically provisioned

**DNS Setup:**
- Add CNAME record: `book.yourbusiness.com` → `buuk.com`
- Wait 24-48 hours for propagation
- System verifies and activates

---

## Payment Settings

Configure payment processing with Stripe integration.

### Stripe Setup

#### Standard Account (Basic)
1. Go to **Settings > Payment Settings**
2. Click **"Connect with Stripe"**
3. Follow Stripe onboarding:
   - Business information
   - Bank account details
   - Identity verification
4. Complete activation

#### Stripe Connect (Pro Feature)
Separate finances between your platform and clients:

1. Enable Stripe Connect in settings
2. Connect your Stripe account
3. Clients receive direct payouts
4. You control fee structure

### Payment Options

#### Payment Methods
Enable multiple payment options:

- **Credit/Debit Cards**: Visa, Mastercard, Amex, Discover
- **Digital Wallets**: Apple Pay, Google Pay
- **Bank Transfers**: ACH (US), SEPA (EU)
- **Pay in Person**: Cash or card at appointment

Configure in **Settings > Payment Settings > Payment Methods**

#### Pay in Person
Allow customers to pay at appointment:

1. Enable **"Pay in Person"** option
2. Choose when to show option:
   - Always available
   - Only for specific services
   - Only for returning customers
3. Add instructions for customers

**Best for:**
- Walk-in customers
- Regular clients you trust
- Services with no-deposit requirement

### Deposits & Prepayment

#### Service Deposits
Require partial payment when booking:

1. Edit service
2. Enable **"Require Deposit"**
3. Set deposit type:
   - **Fixed Amount**: Specific dollar amount (e.g., $25)
   - **Percentage**: Percent of service price (e.g., 50%)
4. Choose when deposit is required:
   - All bookings
   - New customers only
   - Bookings within X days

**Example:** $100 service with 50% deposit = $50 due at booking, $50 at appointment

#### Full Prepayment
Require complete payment upfront:

1. Edit service
2. Set deposit to 100%
3. Customer pays full amount when booking

**Best for:**
- High-demand services
- Frequently cancelled appointments
- Premium or luxury services

### No-Show Fees

Charge customers who miss appointments:

1. Edit service
2. Enable **"No-Show Fee"**
3. Set fee type:
   - **Fixed Amount**: Flat fee (e.g., $50)
   - **Percentage**: Percent of service (e.g., 100%)
   - **Full Service Price**: Charge complete amount
4. Set grace period:
   - How many minutes late before charging
   - Default: 15 minutes

**How It Works:**
1. Customer misses appointment
2. Admin marks as "No-Show"
3. Fee automatically charged to saved card
4. Customer notified of charge

**Important:** Customers must save payment method at booking.

### Cancellation Fees

Charge for late cancellations:

1. Go to **Settings > General > Cancellation Policy**
2. Set minimum cancellation notice (e.g., 24 hours)
3. Configure late cancellation fee:
   - No fee (lenient)
   - Forfeit deposit
   - Fixed cancellation fee
   - Percentage of service price
4. Specify grace period for free cancellations

**Example Policy:**
- Free cancellation: 24+ hours before
- 50% fee: 12-24 hours before
- Full fee: Less than 12 hours

### Refund Management

Process refunds for cancelled bookings:

#### Manual Refunds
1. Open booking
2. Click **"Refund"**
3. Choose refund amount:
   - Full refund
   - Partial refund
   - Custom amount
4. Add refund reason (internal note)
5. Confirm refund

#### Automatic Refunds
Enable automatic refund processing:

1. Go to **Settings > Payment Settings**
2. Enable **"Automatic Refunds"**
3. Set conditions:
   - Cancel within X hours
   - Admin-initiated cancellations
   - Customer-initiated cancellations
4. Exclude non-refundable services

**Processing Time:**
- Credit/debit cards: 5-10 business days
- Digital wallets: 1-3 business days
- Refunds appear as credit on customer's statement

### Pricing & Taxes

#### Tax Configuration
Add applicable taxes to services:

1. Go to **Settings > Payment Settings > Tax Settings**
2. Enable tax collection
3. Add tax rates:
   - **Tax Name**: Sales Tax, VAT, GST
   - **Rate**: Percentage (e.g., 8.5%)
   - **Applied To**: Services, products, or both
4. Display tax:
   - Included in price
   - Added at checkout

#### Multi-Currency Support
Accept payments in different currencies:

1. Set primary currency in **Settings > General**
2. Enable multi-currency (Pro feature)
3. Add supported currencies
4. Set exchange rate update frequency
5. Display currency selector to customers

---

## Gift Cards

Sell and manage digital gift cards.

### Gift Card Setup

Enable gift card sales:

1. Go to **Settings > Gift Cards**
2. Toggle **"Enable Gift Cards"**
3. Configure gift card options

### Gift Card Configuration

#### Preset Amounts
Offer fixed denomination gift cards:

1. Click **"Add Amount"**
2. Set value (e.g., $50, $100, $150)
3. Add design or template
4. Enable/disable each amount

#### Custom Amounts
Allow customers to choose any amount:

1. Enable **"Allow Custom Amounts"**
2. Set minimum amount (e.g., $25)
3. Set maximum amount (e.g., $500)

#### Gift Card Design

Customize gift card appearance:

1. Upload background image or pattern
2. Set text color
3. Add your logo
4. Preview design
5. Save template

**Design Tips:**
- Use high-quality images (1200x600px)
- Ensure text is readable over background
- Maintain brand consistency
- Include your logo
- Avoid busy patterns

#### Message & Personalization

Allow gift givers to add:
- **Recipient Name**: Who the gift is for
- **Recipient Email**: Delivery email address
- **Personal Message**: Custom greeting (max 500 characters)
- **Send Date**: Schedule delivery for specific date

### Selling Gift Cards

#### From Booking Page
Customers purchase gift cards:

1. Click **"Purchase Gift Card"** on booking page
2. Choose amount or enter custom value
3. Add personalization
4. Enter payment information
5. Complete purchase

#### From Admin Panel
Sell gift cards in person or over phone:

1. Go to **Gift Cards**
2. Click **"Create Gift Card"**
3. Fill in details:
   - Amount
   - Recipient email
   - Personal message
   - Payment method (paid, complimentary)
4. Email sent immediately or scheduled

#### Complimentary Gift Cards
Issue free gift cards:

1. Create gift card
2. Select **"Complimentary"** as payment type
3. Add reason (internal note)
4. Send to customer

**Use Cases:**
- Apology for service issue
- Competition/promotion winner
- Staff appreciation gifts
- Referral rewards

### Gift Card Redemption

#### During Booking
Customers apply gift cards at checkout:

1. Complete booking flow
2. On payment step, click **"Apply Gift Card"**
3. Enter gift card code
4. Balance applied to total
5. Pay remaining balance (if any)

#### Manual Application
Apply gift card to existing booking:

1. Open booking
2. Click **"Apply Gift Card"**
3. Enter code
4. Adjust payment amount
5. Save changes

### Gift Card Management

#### Viewing Gift Cards

See all gift cards at **Gift Cards** in admin:

- **Active**: Unused or partially used balance
- **Redeemed**: Fully used gift cards
- **Expired**: Past expiration date (if set)

#### Gift Card Details

Click any gift card to view:
- **Code**: Unique identifier
- **Original Value**: Purchase amount
- **Current Balance**: Remaining value
- **Recipient**: Email and name
- **Purchaser**: Who bought it
- **Purchase Date**: When created
- **Expiration Date**: If applicable
- **Transaction History**: All redemptions

#### Gift Card Actions

Available actions:
- **Adjust Balance**: Add or subtract value
- **Extend Expiration**: Give more time to use
- **Resend Email**: Send code again
- **Deactivate**: Prevent further use
- **Refund**: Issue refund for unused balance

### Gift Card Reporting

Track gift card performance:

1. Go to **Gift Cards > Reports**
2. View metrics:
   - **Total Sold**: Revenue from gift card sales
   - **Total Redeemed**: Value used by customers
   - **Outstanding Balance**: Unredeemed value
   - **Breakage Rate**: Percent never redeemed
3. Export data for accounting

---

## Loyalty Program

Reward repeat customers with points and perks.

### Loyalty Setup

Enable loyalty program:

1. Go to **Settings > Loyalty Program**
2. Toggle **"Enable Loyalty Program"**
3. Configure program settings

### Points Configuration

#### Earning Points

Set how customers earn points:

**Purchase-Based**
- **Points per Dollar**: Base earning rate
  - Example: 10 points per $1 spent
  - $100 booking = 1,000 points

**Service-Based**
- **Points per Booking**: Fixed points per visit
  - Example: 500 points per completed appointment

**Bonus Points**
- **Birthday Month**: Extra points during birthday
- **Referrals**: Points for referring friends
- **Reviews**: Points for leaving testimonials
- **Social Media**: Points for shares and follows

#### Redeeming Points

Set redemption value:

- **Points to Dollar Ratio**: How much points are worth
  - Example: 1,000 points = $10
  - 10,000 points = $100 discount

**Redemption Rules:**
- Minimum points required (e.g., 1,000)
- Maximum discount per booking (e.g., 50%)
- Expiration period (e.g., 12 months)
- Services excluded from redemption

### Loyalty Tiers

Create tier levels with benefits:

#### Tier Structure
Example 3-tier program:

**Silver Tier** (0-2,500 points)
- Base earning rate: 10 points/$1
- Birthday bonus: 2x points
- Priority booking: Standard

**Gold Tier** (2,501-10,000 points)
- Earning rate: 15 points/$1 (50% bonus)
- Birthday bonus: 3x points
- Priority booking: 48-hour advance
- Exclusive promotions

**Platinum Tier** (10,001+ points)
- Earning rate: 20 points/$1 (100% bonus)
- Birthday bonus: 5x points
- Priority booking: Anytime
- Complimentary upgrades
- VIP treatment

Configure tiers at **Settings > Loyalty > Tiers**

### Loyalty Communications

Engage customers with automated messages:

#### Welcome Email
- Sent when customer joins program
- Explain earning and redemption
- Set expectations

#### Milestone Emails
- New tier achieved
- Points milestones (1,000, 5,000, 10,000)
- Congratulate and motivate

#### Reminder Emails
- Points expiring soon
- Haven't visited in X days
- Special member-only promotions

#### Monthly Statements
- Points earned this month
- Current balance
- Progress to next tier
- Recommended redemptions

### Managing Customer Loyalty

#### Viewing Loyalty Status

See customer loyalty info:

1. Open customer profile
2. View **Loyalty** section:
   - Current points balance
   - Tier level
   - Points earned (lifetime)
   - Points redeemed (lifetime)
   - Next tier requirements

#### Manual Adjustments

Add or remove points:

1. Open customer profile
2. Click **"Adjust Points"**
3. Choose:
   - Add points (for compensation, bonus)
   - Subtract points (for correction)
4. Enter amount and reason
5. Save (customer notified automatically)

**Use Cases:**
- Service recovery (add points for issue)
- Special recognition (birthday, anniversary)
- Referral bonuses
- Error corrections

### Loyalty Reporting

Track program performance:

1. Go to **Loyalty > Reports**
2. View metrics:
   - **Active Members**: Customers enrolled
   - **Points Issued**: Total points earned
   - **Points Redeemed**: Total points used
   - **Redemption Rate**: Percent of earned points used
   - **Average Points per Customer**: Engagement metric
   - **Tier Distribution**: Members in each tier
3. Analyze trends and adjust program

---

## Team & Staff Management

Manage staff access, permissions, and roles.

### Staff Roles

Different permission levels for team members:

#### Owner
- Full system access
- Can't be removed or restricted
- Manages billing and subscription
- Assigns other roles

#### Admin
- Complete access to all features
- Manage bookings, customers, services
- Access to settings and reports
- Can manage other staff (except owner)
- View all financial data

#### Manager
- Manage day-to-day operations
- Book and manage appointments
- View customer information
- Limited access to settings
- View reports (no raw data export)

#### Specialist/Staff
- View own schedule and bookings
- Manage assigned appointments
- View assigned customer info
- No access to settings
- Limited reporting (own stats only)

#### Receptionist
- Create and manage bookings
- Check-in customers
- Process payments
- Limited customer data access
- No settings access

### Inviting Team Members

Add new staff to the system:

1. Go to **Team Management**
2. Click **"Invite Staff Member"**
3. Fill in details:
   - **Email**: Staff member's email
   - **Full Name**: Display name
   - **Role**: Select permission level
   - **Specialist Profile**: Link to existing specialist (optional)
4. Send invitation

**Invitation Process:**
1. Staff receives email invitation
2. Clicks link to create account
3. Sets password
4. Gains access based on assigned role

### Custom Permissions (Pro Feature)

Fine-tune access for each role:

#### Bookings Permissions
- [ ] View all bookings
- [ ] View own bookings only
- [ ] Create bookings
- [ ] Edit bookings
- [ ] Cancel bookings
- [ ] Reschedule bookings
- [ ] Process refunds

#### Customer Permissions
- [ ] View all customers
- [ ] View own customers only
- [ ] Create customers
- [ ] Edit customer info
- [ ] Delete customers
- [ ] View customer notes
- [ ] Add customer notes
- [ ] Export customer data

#### Service Permissions
- [ ] View services
- [ ] Create services
- [ ] Edit services
- [ ] Delete services
- [ ] Manage service pricing

#### Financial Permissions
- [ ] View all payments
- [ ] Process payments
- [ ] Issue refunds
- [ ] View financial reports
- [ ] Export financial data
- [ ] Manage payment settings

#### Settings Permissions
- [ ] Access general settings
- [ ] Modify business info
- [ ] Manage integrations
- [ ] Customize booking form
- [ ] Manage email templates

### Managing Existing Staff

View and modify staff access:

1. Go to **Team Management**
2. View staff list showing:
   - Name and email
   - Role
   - Status (Active, Pending, Inactive)
   - Last login
3. Click staff member to edit:
   - Change role
   - Modify permissions
   - Deactivate access
   - Remove from team

#### Deactivating Staff
Temporarily disable access:

1. Open staff profile
2. Toggle **"Active"** status
3. Account locked but data preserved
4. Reactivate anytime

#### Removing Staff
Permanently remove team member:

1. Open staff profile
2. Click **"Remove from Team"**
3. Confirm removal
4. Specialist profile preserved (if applicable)
5. Bookings and history maintained

### Staff Activity Logs

Track team actions for security:

1. Go to **Team Management > Activity Log**
2. View history:
   - Who performed action
   - What action (login, booking created, etc.)
   - When it occurred
   - IP address
   - Device information
3. Filter by:
   - Staff member
   - Action type
   - Date range
4. Export for security audits

---

## Email Notifications

Automated email system for customer communication.

### Email Types

#### Transactional Emails
Sent automatically based on actions:

**Booking Confirmation**
- Sent when booking is created/confirmed
- Includes: Service, date/time, specialist, location
- Attached: Calendar event (.ics file)

**Booking Reminder**
- Sent before appointment (configurable timing)
- Default: 24 hours before
- Helps reduce no-shows

**Booking Modification**
- Sent when details change
- Shows old and new information
- Updated calendar event attached

**Cancellation Notice**
- Sent when booking is cancelled
- Includes cancellation reason (if provided)
- Refund information (if applicable)

**Payment Receipt**
- Sent after successful payment
- Shows itemized charges
- Payment method used
- Transaction ID for reference

**Gift Card Delivery**
- Sent to gift card recipient
- Includes gift card code and balance
- Personal message from sender
- Redemption instructions

**Loyalty Updates**
- Points earned notification
- Tier upgrade congratulations
- Points expiration warning
- Reward availability

#### Marketing Emails
Promotional communications:

- **Welcome Series**: New customer onboarding
- **Re-engagement**: Win back inactive customers
- **Special Promotions**: Limited-time offers
- **Seasonal Campaigns**: Holiday specials
- **Event Announcements**: Workshops, open houses

### Email Configuration

#### SMTP Settings

Configure email sending:

1. Go to **Settings > Email Settings**
2. Choose provider:
   - **Platform Email**: Default Buuk email service (recommended)
   - **Custom SMTP**: Your own email server
   - **SendGrid**: Integration with SendGrid
   - **Mailgun**: Integration with Mailgun

**Platform Email (Recommended):**
- No configuration needed
- Reliable delivery
- Automatic spam filtering
- Sent from: `notifications@yourbusiness.buuk.com`

**Custom SMTP:**
- Requires configuration:
  - SMTP host
  - Port (usually 587 or 465)
  - Username and password
  - From email address
  - From name
- Test connection before saving

#### Email Templates

Customize email content and design:

1. Go to **Settings > Email Templates**
2. Select template type
3. Edit components:
   - **Subject Line**: Email subject
   - **Preheader**: Preview text
   - **Header**: Logo and business name
   - **Body**: Main message content
   - **Footer**: Contact info and links

**Available Variables:**
Use these placeholders in templates:
- `{customer_name}`: Customer's name
- `{service_name}`: Booked service
- `{date}`: Appointment date
- `{time}`: Appointment time
- `{specialist_name}`: Assigned specialist
- `{business_name}`: Your business name
- `{booking_id}`: Reference number
- `{total_price}`: Booking total
- `{gift_card_code}`: Gift card code
- `{points_balance}`: Loyalty points

**Example Subject Line:**
```
Your appointment with {specialist_name} on {date}
```

Becomes:
```
Your appointment with Sarah Johnson on March 15
```

### Email Automation

#### Booking Reminder Schedule

Configure reminder timing:

1. Go to **Settings > Email Settings > Reminders**
2. Set reminder schedule:
   - First reminder: 7 days before
   - Second reminder: 24 hours before
   - Final reminder: 2 hours before (SMS if enabled)
3. Customize content for each reminder
4. Enable/disable per service or customer

#### Follow-up Emails

Send post-appointment communications:

**Thank You Email**
- Sent: 2 hours after appointment
- Content: Thank customer, request feedback
- Include: Review link, rebook CTA

**Review Request**
- Sent: 24 hours after appointment
- Content: Ask for online review
- Include: Links to Google, Yelp, Facebook

**Rebook Reminder**
- Sent: 4 weeks after appointment
- Content: Time for next appointment
- Include: Personalized service recommendations

Configure at **Settings > Email Settings > Follow-up**

### Email Logs

Track all sent emails:

1. Go to **Settings > Email Settings > Logs**
2. View email history:
   - Recipient
   - Subject line
   - Template used
   - Sent date/time
   - Status (Sent, Failed, Bounced, Opened)
   - Opens and clicks (if tracking enabled)
3. Resend failed emails
4. Export logs for records

### Email Deliverability

Ensure emails reach customers:

#### Domain Authentication (Pro)
Improve deliverability with verified sending domain:

1. Add custom sending domain
2. Configure DNS records:
   - SPF record
   - DKIM record
   - DMARC record
3. Verify setup
4. Emails sent from your domain

#### Bounce Management
Handle bounced emails:

- **Soft Bounce**: Temporary issue (full mailbox)
  - Retry automatically
  - Flag after 3 failures

- **Hard Bounce**: Permanent failure (invalid email)
  - Stop sending immediately
  - Mark customer record
  - Request email update

#### Spam Prevention
Keep emails out of spam folders:

- Use verified sending domain
- Maintain clean email list
- Include unsubscribe link
- Avoid spam trigger words
- Test emails before sending
- Monitor spam complaints

---

## Customer Portal

Self-service portal for customers to manage bookings.

### Portal Access

Customers access their portal at:
```
https://yourbusiness.buuk.com/account
```

### Customer Registration

New customers create accounts:

1. Click **"Sign Up"** on booking page
2. Enter email and password
3. Verify email address
4. Complete profile (optional)
5. Start booking immediately

**OAuth Options:**
- Sign in with Google
- Sign in with Facebook
- Sign in with Apple (Pro feature)

### Portal Features

#### Dashboard

Customer homepage shows:
- **Upcoming Bookings**: Next scheduled appointments
- **Booking History**: Past appointments
- **Loyalty Points**: Current balance and tier
- **Gift Cards**: Active gift card balances
- **Quick Actions**: Rebook, cancel, manage profile

#### My Bookings

View and manage appointments:

**Upcoming Tab:**
- See all future bookings
- View appointment details
- Add to calendar
- Get directions to location
- Cancel booking (if within policy)
- Reschedule (if enabled)

**Past Tab:**
- View completed appointments
- Rebook same service
- Leave review/rating
- Download receipts

#### Booking Actions

Customers can self-serve:

**Reschedule:**
1. Click **"Reschedule"**
2. Choose new date/time
3. Confirm changes
4. Receive updated confirmation

**Cancel:**
1. Click **"Cancel Booking"**
2. Select cancellation reason
3. View refund information
4. Confirm cancellation
5. Receive refund (if applicable)

#### Profile Management

Edit personal information:

- **Name**: Update display name
- **Email**: Change email address
- **Phone**: Update contact number
- **Password**: Change password
- **Preferences**:
  - Email notifications on/off
  - SMS notifications on/off
  - Marketing emails opt-in
  - Preferred language
- **Payment Methods**: Manage saved cards

#### Loyalty & Rewards

View loyalty program details:

- **Points Balance**: Current points
- **Points History**: Earning and redemption log
- **Current Tier**: Membership level
- **Next Tier**: Requirements to level up
- **Available Rewards**: What points can buy
- **Redeem**: Apply points to next booking

#### Gift Cards

Manage gift card balance:

- **Active Cards**: View all gift cards
- **Balance**: Check remaining value
- **Purchase Gift Card**: Buy for others
- **Send to Friend**: Forward gift card
- **Transaction History**: See where used

#### Favorites

Save preferences for quick booking:

- **Favorite Services**: Preferred treatments
- **Favorite Specialists**: Preferred staff
- **Quick Rebook**: One-click repeat booking
- **Saved Preferences**: Notes and requests

---

## Advanced Features

### Integrations

#### Google Calendar Sync
Sync bookings to Google Calendar:

1. Go to **Settings > Integrations**
2. Click **"Connect Google Calendar"**
3. Authorize access
4. Choose sync options:
   - Calendar to sync with
   - Event title format
   - Include customer details
   - Two-way sync (Pro)

**Benefits:**
- View bookings in Google Calendar
- Get mobile notifications
- Share availability easily
- Prevent personal conflicts

#### Zoom Integration (Pro)
Offer virtual appointments:

1. Connect Zoom account
2. Enable for specific services
3. Automatic meeting creation
4. Links sent to customer
5. Join from customer portal

**Best for:**
- Consultations
- Follow-up appointments
- Remote services
- Coaching sessions

#### Zapier Integration (Pro)
Connect to 5,000+ apps:

**Popular Automations:**
- New booking → Add to Google Sheets
- New customer → Add to Mailchimp
- Booking completed → Create invoice in QuickBooks
- Review received → Post to Slack
- Gift card sold → Track in Airtable

### Multi-Location Support (Pro)

Manage multiple business locations:

1. Go to **Settings > Locations**
2. Add new location:
   - Location name
   - Address
   - Phone number
   - Working hours
   - Specialists assigned
3. Customers choose location during booking

**Features:**
- Location-specific availability
- Different pricing by location
- Separate staff assignments
- Location-based reporting
- Centralized customer database

### API Access (Pro)

Build custom integrations:

1. Go to **Settings > API**
2. Generate API key
3. View documentation
4. Test endpoints

**Common Use Cases:**
- Mobile app development
- Website integration
- Custom reporting dashboards
- Internal tool connections
- Data exports

### White-Label Options (Enterprise)

Remove Buuk branding:

1. **Custom Domain**: Your domain only
2. **Logo Replacement**: Only your branding
3. **Color Scheme**: Match your brand
4. **Email Sender**: From your domain
5. **Powered By**: Remove "Powered by Buuk"

Contact sales for enterprise options.

### Automated Reporting

Schedule regular reports:

1. Go to **Reports > Schedule**
2. Create report:
   - **Type**: Revenue, bookings, customers
   - **Frequency**: Daily, weekly, monthly
   - **Recipients**: Email addresses
   - **Format**: PDF or Excel
3. Reports sent automatically

**Available Reports:**
- Daily booking summary
- Weekly revenue report
- Monthly performance metrics
- Customer acquisition report
- Service popularity report
- Staff productivity report

---

## Troubleshooting

### Common Issues & Solutions

#### "Booking times not showing"

**Possible Causes:**
1. No working hours set
2. Specialist unavailable
3. All slots booked
4. Service duration too long for remaining time

**Solutions:**
- Check working hours in Settings
- Verify specialist availability
- Review calendar for conflicts
- Adjust service buffer times

#### "Payment failed"

**Possible Causes:**
1. Invalid card information
2. Insufficient funds
3. Card declined by bank
4. Stripe connection issue

**Solutions:**
- Try different payment method
- Contact bank to authorize charge
- Verify Stripe connection active
- Check if test mode is enabled (should be off)

#### "Emails not delivering"

**Possible Causes:**
1. Email in spam folder
2. Invalid email address
3. SMTP configuration issue
4. Domain not verified

**Solutions:**
- Check spam/junk folder
- Verify email address correct
- Test SMTP connection
- Use platform email service
- Configure domain authentication

#### "Customer can't create account"

**Possible Causes:**
1. Email already registered
2. Password too weak
3. Email verification required
4. Account creation disabled

**Solutions:**
- Use "Forgot Password" to reset
- Use stronger password (8+ characters)
- Check email for verification link
- Enable self-registration in settings

#### "Double bookings occurring"

**Possible Causes:**
1. Multiple calendars not synced
2. Buffer times not set
3. Overlapping specialist assignments
4. Time zone mismatch

**Solutions:**
- Enable Google Calendar sync
- Add buffer time to services
- Review specialist availability
- Verify time zone settings match

#### "Gift card not applying"

**Possible Causes:**
1. Code entered incorrectly
2. Gift card expired
3. Balance insufficient
4. Service not eligible

**Solutions:**
- Copy/paste code carefully
- Check expiration date
- Verify remaining balance
- Review gift card terms

### Performance Issues

#### "Admin panel loading slowly"

**Solutions:**
1. Clear browser cache
2. Use modern browser (Chrome, Firefox, Safari)
3. Check internet connection
4. Archive old bookings
5. Reduce simultaneous users

#### "Booking page not responsive"

**Solutions:**
1. Test on different devices
2. Clear browser cache
3. Disable browser extensions
4. Update browser to latest version
5. Check custom CSS (if added)

### Getting Help

#### Support Resources

1. **Help Center**: In-app documentation
2. **Video Tutorials**: YouTube channel
3. **Community Forum**: Connect with other users
4. **Email Support**: support@buuk.com
5. **Live Chat**: Available during business hours (Pro/Enterprise)
6. **Phone Support**: Enterprise only

#### Reporting Bugs

Found a bug? Report it:

1. Go to **Help > Report Issue**
2. Describe the problem:
   - What were you trying to do?
   - What happened instead?
   - Steps to reproduce
3. Include screenshots
4. Submit report

---

## Best Practices

### Booking Management

**Do:**
- ✅ Confirm bookings within 24 hours
- ✅ Send reminder emails consistently
- ✅ Keep specialist availability updated
- ✅ Follow up after appointments
- ✅ Respond to cancellations promptly
- ✅ Maintain accurate service durations
- ✅ Block holidays and closures in advance

**Don't:**
- ❌ Leave pending bookings unconfirmed
- ❌ Overbook specialists
- ❌ Ignore buffer times
- ❌ Skip customer communication
- ❌ Change prices without notice
- ❌ Cancel confirmed bookings unnecessarily

### Customer Service

**Do:**
- ✅ Respond to inquiries within 2 hours
- ✅ Personalize communications
- ✅ Remember customer preferences
- ✅ Offer flexible rescheduling
- ✅ Thank customers after visits
- ✅ Request feedback regularly
- ✅ Reward loyal customers

**Don't:**
- ❌ Use generic automated responses
- ❌ Ignore negative feedback
- ❌ Make exceptions inconsistently
- ❌ Oversell services
- ❌ Share customer information
- ❌ Miss follow-up opportunities

### Financial Management

**Do:**
- ✅ Reconcile payments daily
- ✅ Track deposits and refunds
- ✅ Monitor no-show rates
- ✅ Review pricing quarterly
- ✅ Export financial reports monthly
- ✅ Keep payment methods current
- ✅ Comply with tax regulations

**Don't:**
- ❌ Process refunds without verification
- ❌ Store payment info outside Stripe
- ❌ Ignore failed payments
- ❌ Change prices mid-booking
- ❌ Skip payment reconciliation
- ❌ Mix business and personal finances

### Data Security

**Do:**
- ✅ Use strong passwords (12+ characters)
- ✅ Enable two-factor authentication
- ✅ Review staff access regularly
- ✅ Monitor activity logs
- ✅ Backup data regularly
- ✅ Update security settings
- ✅ Train staff on data privacy

**Don't:**
- ❌ Share login credentials
- ❌ Use public Wi-Fi for admin access
- ❌ Grant unnecessary permissions
- ❌ Keep inactive staff accounts active
- ❌ Export customer data unsecurely
- ❌ Click suspicious email links

### Marketing & Growth

**Do:**
- ✅ Encourage online reviews
- ✅ Offer first-time customer discounts
- ✅ Create referral programs
- ✅ Share before/after photos (with permission)
- ✅ Post regularly on social media
- ✅ Run seasonal promotions
- ✅ Collect customer testimonials

**Don't:**
- ❌ Spam customers with emails
- ❌ Buy fake reviews
- ❌ Make unrealistic promises
- ❌ Copy competitors exactly
- ❌ Ignore negative feedback
- ❌ Discount excessively

---

## FAQ

### General Questions

**Q: Can I try the system before purchasing?**
A: Yes! We offer a 14-day free trial with full access to all features.

**Q: Is there a mobile app?**
A: The system is fully responsive and works on mobile browsers. Native apps coming soon for Pro/Enterprise plans.

**Q: Can I import existing customer data?**
A: Yes! Contact support for CSV import assistance.

**Q: How many bookings can I manage?**
A: No limits on any plan. Handle 10 or 10,000 bookings per month.

**Q: Is my data backed up?**
A: Yes, automatic daily backups with 99.9% uptime guarantee.

### Pricing & Plans

**Q: What's included in the Free plan?**
A: Basic booking, 1 specialist, 5 services, email support, Buuk branding.

**Q: What are the differences between plans?**
- **Free**: Perfect for solo practitioners starting out
- **Standard** ($29/mo): Multiple specialists, unlimited services, custom branding
- **Pro** ($79/mo): Advanced features, integrations, priority support, no transaction fees

**Q: Can I change plans anytime?**
A: Yes! Upgrade or downgrade anytime. Changes effective immediately.

**Q: Are there transaction fees?**
A: Standard Stripe processing fees apply (2.9% + $0.30). No additional Buuk fees on Pro plan.

**Q: What payment methods do you accept?**
A: Credit cards, debit cards, and PayPal for subscriptions.

### Technical Questions

**Q: What browsers are supported?**
A: Chrome, Firefox, Safari, Edge (latest 2 versions). IE not supported.

**Q: Do I need technical skills to set up?**
A: No! Intuitive interface designed for non-technical users.

**Q: Can I customize the booking page URL?**
A: Pro plans include custom domain support.

**Q: Is the system HIPAA compliant?**
A: Enterprise plan offers HIPAA compliance for medical practices.

**Q: What about GDPR compliance?**
A: Fully GDPR compliant with data protection and privacy controls.

### Support & Training

**Q: What support is included?**
- **Free**: Email support (48-hour response)
- **Standard**: Email support (24-hour response)
- **Pro**: Email + live chat (4-hour response)
- **Enterprise**: Phone + dedicated account manager

**Q: Is training available?**
A: Yes! Video tutorials, help documentation, and webinars included. Personal onboarding available for Enterprise.

**Q: Can I get help with setup?**
A: Pro and Enterprise plans include setup assistance.

---

## Conclusion

Congratulations! You now have a comprehensive understanding of the Buuk booking system. This platform will help you:

- **Save Time**: Automate booking and customer management
- **Increase Revenue**: Reduce no-shows, sell gift cards, reward loyalty
- **Delight Customers**: Professional, easy booking experience
- **Grow Your Business**: Scale from solo to multi-location

### Next Steps

1. **Complete Your Setup**: Finish the profile completion checklist
2. **Add Your Services**: Create your service catalog
3. **Customize Branding**: Make the booking page your own
4. **Test the Flow**: Book a test appointment
5. **Go Live**: Share your booking link with customers
6. **Monitor & Optimize**: Use reports to improve operations

### Stay Connected

- **Newsletter**: Monthly tips and feature updates
- **Blog**: Industry insights and best practices
- **Community**: Connect with other Buuk users
- **Social Media**: Follow us for news and inspiration

### Contact Us

- **Email**: support@buuk.com
- **Live Chat**: Available in admin panel (Pro+)
- **Phone**: Enterprise customers call dedicated line
- **Help Center**: help.buuk.com

Thank you for choosing Buuk for your business!

---

*Last Updated: December 2025*
*Version 2.0*
