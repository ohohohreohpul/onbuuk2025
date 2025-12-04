/*
  # Remove Demo Business from Production

  1. Changes
    - Removes the demo business (id: 00000000-0000-0000-0000-000000000001)
    - This was used during development but is no longer needed
    - All new users should create their own accounts via signup

  2. Safety
    - Uses CASCADE to clean up all related data
    - Only removes the specific demo business UUID
*/

-- Delete the demo business and all its related data
DELETE FROM businesses 
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Note: Related data will be deleted automatically via CASCADE constraints
-- This includes: admin_users, services, specialists, bookings, etc.