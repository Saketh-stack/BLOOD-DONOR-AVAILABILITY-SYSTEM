# Blood Donor Availability System Walkthrough

I have successfully built the Blood Donor Availability website as a "student project" style application using Vanilla HTML, CSS, and JavaScript.

## Project Structure
The project consists of the following files in the workspace:
- [index.html](file:///c:/Users/ACER/OneDrive/Desktop/wps/index.html): The landing page.
- [register.html](file:///c:/Users/ACER/OneDrive/Desktop/wps/register.html): The donor registration form.
- [search.html](file:///c:/Users/ACER/OneDrive/Desktop/wps/search.html): The donor search and filtering interface.
- [contact.html](file:///c:/Users/ACER/OneDrive/Desktop/wps/contact.html): About and contact information.
- [style.css](file:///c:/Users/ACER/OneDrive/Desktop/wps/style.css): The simple, red-themed styling.
- [script.js](file:///c:/Users/ACER/OneDrive/Desktop/wps/script.js): The logic for state management using `localStorage`.

## Key Features Implemented

### 1. Donor Registration
Users can enter their Name, Blood Group, Location, and Phone number. Data is saved locally in the browser's `localStorage`, making it persistent even after a page refresh.

### 2. Search and Filtering
On the "Find Donor" page, users can filter by Blood Group and Location. The results are displayed in a card format.

### 3. Real-time Statistics
The Home and Search pages both display the total number of registered donors, which updates automatically as new donors are added.

### 4. Admin/Testing Utility
I added a "Clear All Data" button on the search page to easily wipe the `localStorage` for testing purposes.

## Design Aesthetic
As requested, the design uses:
- **System Fonts**: Arial/Sans-serif.
- **Classic Palette**: Deep Red (`#D32F2F`), White, and Light Gray.
- **Simple Layout**: Centered containers with clear navigation.
- **Human Touch**: Realistic spacing and straightforward HTML/CSS structure.

## How to Test
1. Open [index.html](file:///c:/Users/ACER/OneDrive/Desktop/wps/index.html) in your browser.
2. Go to the **Register** page and add a few donors.
3. Go to the **Find Donor** page and try searching by blood group or location.
4. Verify that the "Total Donors" count updates correctly.

> [!NOTE]
> All data is stored in your browser's local storage. No information is sent to a server.
