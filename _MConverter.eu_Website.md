Hello, Good Morning, I have the following Resources,  
1. Company name : TWOEM ONLINE PRODUCTIONS  
2. Contact email : <twoemcyber@gmail.com> (receives all form submissions
and replies)  
3. Support Email : <twoem.website@gmail.com> (Sender Email for All
Automated & Contact Emails)  
4. Whatsaap Contact: +254707330204 (Catherine)  
5. Website Support : +254740841168 (Josphat)  
6. Images Stored in the /images folder

website creation  
All pages share a consistent header/footer, site title "Twoem \|
PageName", responsive design, quick links in footer with blue text for
visibility. Designer credit "WHIZ" used where examples refer to names.
And the favicon.png in the images folder used as the icon for the
website and twoem.png as the logo

This is what you are required to do, create a website with the following
parts  
Menus in Hamberger Menu for mobile layouts

- Home ( Twoem \| Home)

- Gallery (Twoem \| Gallery)

- Services ( Twoem \| Services)

- Downloads (Twoem \| Downloads)

- Data Protection (Twoem \| Data Protection Act)

- Portals (Twoem \| Portals)  
  a) Admin Portal (Twoem \| Admin Portal)  
  b) Students Portal (Twoem \| Students Portal)

- Contact Us (Twoem Contact)

SECTION \#

    SECTION F
    - Anchor: Include id="contact" on Contact section on every page footer or within pages.
    - Stand-alone URL (optional): /contact
    - Title: Twoem | Contact
    - Content:
      - Contact Form:
        - Fields: Name (text), Email (email), Subject (optional text), Message (textarea).
        - Spam Protection: Google reCAPTCHA v2/v3 or honeypot field.
        - Form submission: POST to /contact.
      - Server Handling:
        - On submit, capture form data.
        - Send email via Nodemailer using SMTP credentials for twoem.website@gmail.com:
          - Sender: "No Reply" <twoem.website@gmail.com>
          - Recipient: twoemcyber@gmail.com
          - Reply-To: twoemcyber@gmail.com
          - Subject: e.g., Contact Form Submission from <Name>
          - Body: Include Name, Email, Subject, Message.
        - Respond to user: render a “Thank you” message or JSON success response.
        - Log submission in server logs or optionally store in DB for audit.
      - Additional Info:
        - Display address and phone below form.
        - Optionally embed Google Maps iframe.
    - Environment Variables:
      env
      EMAIL_USER=twoem.website@gmail.com
      EMAIL_PASS=<app-password-or-oauth-for-twoem.website@gmail.com>

- **Validation & UX**:

  - Client-side validation for required fields.
  - Server-side validation and sanitization.
  - Show error messages for invalid inputs or send failures.
  - Show success confirmation after sending.

- **Accessibility**:

  - Proper labels, ARIA attributes, focus management.
  - Ensure form usable via keyboard.

- **Layout**:

  - Clean form design with Tailwind: input fields with borders and focus
    styles, submit button styled blue.
  - Responsive.

SECTION 1  
Home Page  
to have the following  
  
- URL: ***\`/\`***  
- Title: ***\`Twoem \| Home\`***  
- Optional Splash Screen: On initial access, show a branded splash
screen with message "Welcome to Twoem Services" for 3--6 seconds, then
redirect/display Home content.  
- Sections:  
1. Welcome Banner:  
- Headline: "Your One-Stop Digital Gateway"  
- Intro text:  
\> "Welcome to Twoem Cyber Café -- your one-stop center for eCitizen
services, digital printing, internet access, computer training, and
more. We handle paperwork, printing, and digital tasks so you can focus
on what matters."  
- Prominent "Get Started" or "Our Services" button linking to Services
page.  
2. Services Overview Teaser:  
- Short description or cards for main categories: Digital Printing &
Design, Government & Official Services, Office & Digital Services,
Internet Services, Computer Training / Student Portal.  
- Each card: icon/image, brief text, "Learn More" linking to Services
page anchor.  
3. Gallery Preview:  
- Responsive grid (e.g., 3 columns on desktop, 1 column on mobile)
showing:  
- ***\`/images/Photo1.jpg\`*** with caption "Photocopy in Process"  
- ***\`/images/Photo2.jpg\`*** with caption "eCitizen Services"  
- ***\`/images/Photo3.jpg\`*** with caption "Welcome"  
- Clicking opens lightbox/enlarged view or navigates to Gallery page.

- 4\. Quick Links / Call-to-Action Cards:  
  - Buttons or cards for: Services, Downloads, Contact, Admin Login,
  Student Login.  
  - Styled with ***\`bg-blue-600 text-white rounded px-4 py-2
  hover:bg-blue-700\`***.

- 5\. Location Info:  
  - Address text and optionally an embedded Google Maps iframe showing
  "Kagwe Town, Plaza Building, First Floor, Opposite Total Petrol
  Station".  
    
  6. Footer:

- As per common layout.

- Behavior:  
  - Responsive design with hamburger menu on smaller viewports.  
  - Preload key images for speed; lazy-load gallery images if desired.

SECTION B  
- URL: ***\`/gallery\`***  
- Title: ***\`Twoem \| Gallery\`***  
- Content:  
- Responsive grid of gallery images (Photo1, Photo2, Photo3).  
- Captions below each image.  
- Lightbox/enlarge functionality (via JS plugin or custom).  
- Possibly additional images if available.  
- Footer with quick links and Contact anchor.  
- Accessibility: ***\`alt\`*** attributes for images ("Photocopy in
Process", etc.).

SECTION C  
- URL: ***/services***  
- Title: ***Twoem \| Services***  
- Structure: Several sections/cards, each with image, header, list of
services, and "Get Service" WhatsApp button linking to
***https://wa.me/254707330204?text=\...*** with appropriate URL-encoded
text.  
- Sections:  
1. A. Digital Printing & Design  
- Image: ***/images/digitalprint.jpeg***  
- Header: "🖨️ Digital Printing & Design"  
- List:  
- Business Cards  
- Award Certificates  
- Brochures  
- Funeral Programs  
- Handouts  
- Flyers  
- Maps  
- Posters  
- Letterheads  
- Calendars  
- Button:  
***html***  
**\<a**
**href**=\"https://wa.me/254707330204?text=I%20need%20Digital%20Printing%20Services\"
**target**=\"\_blank\" **class**=\"btn\"**\>**Get Service**\</a\>**  
  
2. B. Government & Official Services  
- Subsections:  
- eCitizen Services  
- Image: ***/images/ecitizen1.jpeg***  
- List:  
- Passport Application & Renewal (Adults & Children)  
- Certificate of Good Conduct (DCI Police Clearance)  
- Birth & Death Certificate Applications  
- Marriage Registration & Licensing  
- CRB Clearance Certificate  
- HELB Loan Application & Clearance  
- TSC Number Application & GHRIS Payslip Access  
- NHIF & NSSF Registration  
- Business Name Search & Registration  
- Company Registration  
- Land Rent Clearance Certificate & Official Land Search (Ministry of
Lands)  
- Driving License Renewal & NTSA Bookings (Vehicle Inspection, Logbook
Transfers)  
- Button:  
***html***  
**\<a**
**href**=\"https://wa.me/254707330204?text=I%20need%20eCitizen%20Services\"
**target**=\"\_blank\" **class**=\"btn\"**\>**Get Service**\</a\>**  
  
- iTax (KRA) Services  
- Image: ***/images/itax.jpeg***  
- List:  
- New KRA PIN Registration (Individual & Company)  
- Group PIN Registration  
- Tax Returns Filing (Annual & Nil Returns)  
- Tax Compliance Certificate Application  
- PIN Retrieval & Update  
- Certificate Reprinting  
- iTax Account Assistance & Recovery  
- Button:  
***html***  
**\<a**
**href**=\"https://wa.me/254707330204?text=I%20need%20iTax%20Services\"
**target**=\"\_blank\" **class**=\"btn\"**\>**Get Service**\</a\>**  
  
3. C. Office & Digital Services  
- Image: ***/images/Services.jpeg***  
- Header: "🖨️ Office & Digital Services"  
- List:  
- Photocopying  
- Printing (Black & White / Colour)  
- Document Typing & Editing  
- Scanning (Document & Photo)  
- Binding (Comb & Wire) & Lamination  
- Instant Passport Photos  
- Button:  
***html***  
**\<a**
**href**=\"https://wa.me/254707330204?text=I%20need%20Office%20Services\"
**target**=\"\_blank\" **class**=\"btn\"**\>**Get Service**\</a\>**  
  
4. D. Internet Services  
- Image: ***/images/Browsing.jpeg***  
- Header: "🌐 Internet Services"  
- List:  
- High-Speed Browsing (e.g., 1/- per minute)  
- Online Form Submission & Email Setup  
- Account Creation (Email, Social, Government)  
- Online Application Support  
- Button:  
***html***  
**\<a**
**href**=\"https://wa.me/254707330204?text=I%20need%20Internet%20Services\"
**target**=\"\_blank\" **class**=\"btn\"**\>**Get Service**\</a\>**  
  
5. E. Other Computer & Support Services  
- Header: "🖥️ Other Computer & Support Services"  
- List:  
- Computer Students Online Portal and Classes  
- Design & Layout  
- Map & Poster Design  
- Award Certificate Design  
- Business Card Layout  
- Button (generic or specific):  
***html***  
**\<a**
**href**=\"https://wa.me/254707330204?text=I%20need%20Support%20Services\"
**target**=\"\_blank\" **class**=\"btn\"**\>**Get Service**\</a\>**  
  
- Layout:  
- Each section in a card (***bg-white rounded-lg shadow p-6 mb-6***). Or
better  
- Responsive: side-by-side on desktop where appropriate, stacked on
mobile.  
- Footer: Contact anchor, quick links.  
- Accessibility: alt attributes for images.  
  
SECTION D  
- URL: ***/downloads***  
- Title: ***Twoem \| Downloads***  
- Purpose: Provide lists of downloadable files: Public Documents
(permanent) and Eulogy Documents (auto-expire after 7 days).  
- Content:  
- Public Documents:  
- Admin-uploaded files, permanently available.  
- Display: original filename, upload date.  
- Search/filter by name or date.  
- Download link: ***\<a href=\"/uploads/public/\<storedName\>\"
download\>\<originalName\>\</a\>***.  
- Eulogy Documents:  
- Admin-uploaded category "Eulogy" with upload timestamp.  
- Expiry date = uploadDate + 7 days.  
- Display: original filename, upload date, expiry date.  
- If expired: hide from list or mark as "Expired".  
- UI:  
- Search input for filtering.  
- Table or list view styled with Tailwind (striped rows, clear
columns).  
- Buttons or icons for download.  
- Notice if no files available.  
- Backend:  
- API endpoints (e.g., GET ***/api/downloads/public***) or
server-rendered template passing current lists.  
- For Eulogy: backend checks expiry and filters out expired before
rendering.  
- Footer: quick links, Contact anchor.  
- File Serving:  
- Use Express static or authenticated routes (downloads are public, so
static is fine for public docs).  
- Ensure safe path resolution; prevent directory traversal.  
- Cleanup:  
- Scheduled job or on-request logic to delete expired eulogy files and
remove metadata.  
- Storage:  
- Persistent storage: Render persistent disk or external storage (S3).
In development, local ***public/uploads/public/*** and
***public/uploads/eulogy/***.

SECTION E  
- URL: ***/data-protection***  
- Title: ***Twoem \| Data Protection***  
- Content:  
1. Commitment to Privacy:  
\> At Twoem Cyber Café, we value your privacy. We comply with Kenya's
Data Protection Act, 2019, ensuring transparency, security, and respect
for your personal data.  
2. Data Protection Principles:  
- Lawful & Fair Processing: Data collected/processed only with clear
consent or legitimate need.  
- Data Minimization: Only collect what's necessary for the requested
service.  
- Purpose Limitation: Use data solely for the specified task.  
- Accuracy & Integrity: Verify information to avoid errors affecting
applications/services.  
- Limited Retention: Retain data only as long as needed (or required by
law); delete thereafter.  
- Security & Confidentiality: Handle data in a secure environment; no
unauthorized sharing or external backups unless encrypted and
consented.  
3. Data Handling Table:  
  
\| Type of Data \| Purpose \| Retention \| Security Measures \|  
\|\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--\|\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--\|\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--\|\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--\|  
\| ID / Certificates \| eCitizen, KRA, Exams assistance \| Deleted
immediately \| Not stored externally; processed locally \|  
\| Contact Info (Name, Email, Phone) \| Notifications, Receipts \| Max
30 days \| Encrypted in DB; access-controlled \|  
\| Financial Info (Fees) \| Fees tracking & receipts \| Until payment
done \| Encrypted storage; access-controlled \|  
\| Academic Data (Grades) \| Student progress & certificate eligibility
\| Course duration \| Encrypted in DB; access-controlled \|  
\| Uploaded Docs (Resources/Eulogies) \| Downloads by authorized users
\| Until expiry or manual delete \| Stored in protected storage;
auto-expiry logic \|  
\| Email Reset Tokens \| Password reset process \| Token validity (e.g.,
1 hour) \| Stored hashed in DB; single-use \|  
  
4. Customer Rules:  
- Submit authentic documents; false info may have legal consequences.  
- Provide clear consent before processing personal or official
documents.  
- When using public computers:  
- Log out from all accounts before leaving.  
- Do not install unauthorized software or visit malicious sites.  
- We do not monitor personal browsing beyond security restrictions.  
- Respect other customers' privacy and space.  
- Handle equipment responsibly; damaged equipment may incur fees.  
- Avoid loud conversations or phone use inside service area.  
5. User Rights under Kenya DPA, 2019:  
- Right to access and review personal data on request.  
- Right to request correction or deletion of any data held.  
- Right to withdraw consent at any time.  
- Right to report misuse to the Office of the Data Protection
Commissioner: https://www.odpc.go.ke  
6. Contact for Data Queries:  
- Email: twoemcyber@gmail.com  
- Phone: +254 707 330 204  
- Location: Kagwe Town, Plaza Building, First Floor, Opposite Total
Petrol Station  
7. Cookie & Analytics Notice:  
- If analytics (e.g., Google Analytics) are implemented, inform users
and provide opt-out if required.  
- Use minimal cookies necessary for session management; avoid tracking
cookies unless consented.  
- Layout:  
- Clear headings and subheadings.  
- Data handling table styled with Tailwind or simple markdown table on
static site.  
- Contact section with mailto link.  
- Footer: Quick links, Contact anchor.

## SECTION F PORTALS

- **Portal URL**: `/``portals`

##  TO HAVE 2 BUTTONS FOR BOTH PARTS and a notifications layout in the dashboard for all users to see notices 3. LOGIN PORTALS {#to-have-2-buttons-for-both-parts-and-a-notifications-layout-in-the-dashboard-for-all-users-to-see-notices-3.-login-portals}

There are two distinct portals with separate login and dashboard: Admin
Portal and Student Portal.

### 3.1. Admin Portal (`Twoem`` | Admin`) {#admin-portal-twoem-admin}

- **Login URL**: `/admin/login`

- **Dashboard Base URL**: `/admin/dashboard` and other `/admin/...`
  routes.

- **Title**:

  - Login Page: `Twoem`` | Admin Login`
  - Dashboard and sub-pages: `Twoem`` | Admin - <Section>`

- **Authentication**:

  - **Username**: obtained from environment variable `ADMIN_USERNAME`
    (e.g., "admin").

  - **Password**: bcrypt hash stored in environment variable
    `ADMIN_PASSWORD_HASH`.

    - No UI-based forced reset. Admin password is managed solely by
      updating environment variable to a new bcrypt hash.
    - To rotate: use script to generate bcrypt hash, update env var,
      restart/reload app.

- **Session Management**:

  - Use `express-session` with `secret: ``process.env.SESSION``_SECRET`.
  - Cookies: `HttpOnly`, `secure` flag in production (HTTPS), `sameSite`
    attribute.
  - Session expiration: e.g., 1 hour of inactivity or configurable.

- **Security Measures**:

  - Rate-limiting on login endpoint: e.g., max 5 attempts per 15 minutes
    per IP.
  - Optionally IP whitelisting or 2FA in future (but not mandatory now).
  - Use Helmet for security headers.
  - CSRF protection for state-changing POST routes.

- **Login Flow**:

  1.  Render login form with username and password fields.

  2.  On form POST to `/admin/login`:

      - Compare submitted username to `process.env.ADMIN``_USERNAME`.
      - Compare submitted password via
        `bcrypt.compare``(password, ``process.env.ADMIN``_PASSWORD_HASH``)`.
      - If match: set `req.session``.isAdmin`` = true`, redirect to
        `/admin/dashboard`.
      - If failure: re-render login with generic error "Invalid
        credentials."

  3.  Logout route: `/admin/logout` destroys session and redirects to
      login.

- **Middleware**:

  - `ensureAdmin``(``req, res, next)`: if `req.session``.isAdmin` is
    truthy, allow; else redirect to `/admin/login`.
  - Apply `ensureAdmin` to all `/admin/...` routes except login and
    potentially password rotation instructions (not actual reset).

- **Dashboard & Modules**:

  - After login, admin sees a dashboard overview page with navigation to
    all modules.
  - A "Settings" or "Security" section informs "Admin password is
    managed externally via environment variable; to change, update
    ADMIN_PASSWORD_HASH in environment. No UI reset."

- **Admin Modules**:

  1.  **Student Management**

      - **Register Student**:

        - Inputs: Reg Number (unique, login ID), Full Name, Email,
          Enrollment Date (default current date), Default Password
          `Portal@2025`.

        - Behavior:

          - On creation: hash default password with bcrypt (`saltRounds`
            from env), set `mustResetPassword`` = true`.

          - Send welcome email via `twoem.website@gmail.com`:

            - From: `"No Reply" <twoem.website@gmail.com>`
            - To: student.email
            - Reply-To: `twoemcyber@gmail.com`
            - Subject: "Welcome to Twoem Student Portal"
            - Body: greeting, login Reg Number, default password
              instructions, link to Student Portal, note to change
              password on first login.

          - Store student record in DB: fields including `regNumber`,
            `fullName`, `email`, `passwordHash`, `mustResetPassword`,
            `enrollmentDate`, `isActive``=true`.

      - **Edit Student**:

        - Update details (Full Name, Email). Changing email triggers
          optional notification email.
        - Reg Number cannot be changed.

      - **Deregister Student**:

        - Mark student `isActive``=false`; optionally archive or
          anonymize data per policy. Confirm via modal.
        - Optionally send notification email via
          `twoem.website@gmail.com` to inform deactivation.

      - **Reset Student Password**:

        - Reset password to default `Portal@2025`, set
          `mustResetPassword`` = true`.
        - Hash new default password; update DB.
        - Send reset email via `twoem.website@gmail.com` with reply-to
          `twoemcyber@gmail.com`: "Your password has been reset to
          default. Please login and change immediately."

      - **Send Individual Notification**:

        - Compose message: Title, Body.
        - Save notification record in DB:
          `{ ``studentId``, title, message, ``isGlobal``: false, ``sentAt``, ``readBy``: [``] }`.
        - Send email notification via `twoem.website@gmail.com` to
          student.email, replyTo `twoemcyber@gmail.com`.

      - **Broadcast Notification**:

        - Compose message visible to all active students.
        - Save as notification with `isGlobal``=true`.
        - Optionally send email to all student emails via
          `twoem.website@gmail.com`.

  2.  **Fees Management**

      - **View Fees Dashboard**:

        - Table: Reg Number, Student Name, Total Fees Due (set per
          student or standard course fee), Total Paid (sum of payments),
          Balance (Due - Paid).
        - Search/filter by Reg Number or Name.

      - **Update Payment**:

        - Select student; input: Amount Paid, Payment Date (default
          today), Reference Number.

        - Append payment record to Fees collection:
          `{ ``studentId``, ``amountPaid``, ``paymentDate``, ``referenceNumber``, ``createdAt`` }`.

        - Recalculate total paid and balance.

        - Send payment receipt email via `twoem.website@gmail.com`:

          - From: `"No Reply" <twoem.website@gmail.com>`
          - To: student.email
          - Reply-To: `twoemcyber@gmail.com`
          - Subject: "Payment Received -- Twoem Cyber Café"
          - Body: details of payment, updated balance, thank you
            message.

        - Optionally generate PDF receipt and attach (requires PDF
          generation).

      - **Pending Balances**:

        - Highlight students with balance \> 0.
        - Ability to send reminder email to selected or all pending
          students via `twoem.website@gmail.com`.

      - **Analytics**:

        - Total collected over chosen period.
        - Total outstanding balances.
        - Trends graph (payments per day/week/month).
        - Display via Chart.js or similar.

  3.  **Academics**

      - **Course Units (30%)**:

        - Eight units:

          1.  Introduction to Computers
          2.  Keyboard Management
          3.  Microsoft Word
          4.  Microsoft Excel
          5.  Microsoft Publisher
          6.  Microsoft PowerPoint
          7.  Microsoft Access
          8.  Internet and Email

        - Admin enters marks (0--100) for each unit.

      - **Main Exam (70%)**:

        - Two components:

          - Theory (35% weight)
          - Practical (35% weight)

        - Admin enters marks (0--100) for Theory and Practical.

      - **Final Score Calculation**:

        - Unit average = average of 8 unit marks.
        - Exam average = average of Theory and Practical.
        - Final score = 0.3 unit average + 0.7 exam average (result out
          of 100).

      - **Eligibility**:

        - Final score ≥ 60 AND fees balance = 0 → eligible for
          certificate.
        - Otherwise not eligible; reasons displayed in Student Portal
          ("Fees outstanding" or "Average below 60%" or both).

      - **Grade Input UI**:

        - Admin selects student; display form with fields for 8 unit
          marks and 2 exam marks.

        - Validate inputs between 0 and 100.

        - On save: store marks in Academics collection:
          `{ ``studentId``, ``unitMarks``: {...}, ``examMarks``: {...}, ``finalScore``, ``isEligibleCertificate``, ``updatedAt`` }`.

        - After storing, if eligible:

          - Mark certificate section available in Student Portal.

          - Optionally send email notification via
            <twoem.website@gmail.com>:

            - From: `"No Reply" <twoem.website@gmail.com>`
            - To: student.email
            - Reply-To: <twoemcyber@gmail.com>
            - Subject: "Your Course Results -- Twoem Cyber Café"
            - Body: "Hello , Your final score is . Congratulations! You
              are eligible for the certificate."

          - If not eligible:

            - Optionally send "Result Available" email stating score and
              ineligibility reason.

      - **Grade Analytics**:

        - List of students with final scores; filter by pass/fail.
        - Distribution chart (histogram of scores).
        - Identify students below threshold for remedial support.

  4.  **Resources Upload**

      - **Upload Learning Materials**:

        - Admin can upload files: PDF, DOCX, XLSX, PPTX, JPG, PNG.
        - Size limit: 3MB.
        - Fields: Description (display name), Target Course (select from
          8 units), Expiry Date.
        - Store file in persistent storage; record metadata in DB:
          `{ ``storedName``, ``originalName``, description, ``targetCourse``, ``uploadDate``, ``expiryDate``, ``uploadedBy``, ``createdAt`` }`.

      - **Manage Resources**:

        - List current resources with metadata.
        - Edit description, expiry date, target course.
        - Delete resource manually.

      - **Expiry Handling**:

        - On each dashboard access or via scheduled job (e.g., node-cron
          daily), check for expired resources (expiryDate \< now),
          delete/hide file and remove metadata.

      - **Notifications**:

        - When new resource uploaded: optionally send email notification
          to affected students via <twoem.website@gmail.com> (replyTo
          <twoemcyber@gmail.com>) or in-app notification.

      - **Student Portal Access**:

        - Student sees list of active (non-expired) resources for
          courses they are enrolled in.
        - Download via authenticated route:
          `GET /student/resources/<id>/download`, verifying session and
          authorization.

  5.  **WiFi Credentials Section**

      - **Fields**: SSID, Password, Connection Instructions (text),
        Disclaimer ("Do not share or risk disconnection").
      - Admin updates values via dashboard.
      - Store in DB:
        `{ ``ssid``, password, instructions, disclaimer, ``updatedAt``, ``createdAt`` }`.
      - Student Portal displays current WiFi credentials and
        instructions.
      - Optionally send email notification on change via
        <twoem.website@gmail.com>.

  6.  **Notifications Center**

      - **Global Broadcast**:

        - Admin composes message visible to all active students.
        - Save in DB:
          `{ ``studentId``: null, title, message, ``isGlobal``: true, ``sentAt``, ``readBy``: [``] }`.
        - Optionally send email broadcast to all students via
          <twoem.website@gmail.com>.

      - **Individual Notifications**:

        - Admin selects single student; compose title & message.
        - Save in DB with `studentId`, `isGlobal:false`, `readBy``: []`.
        - Send email via <twoem.website@gmail.com>.

      - **Student Portal**:

        - Inbox-like interface listing notifications (global +
          individual).
        - Display unread badge count.
        - Clicking marks as read (update DB: add studentId to readBy or
          separate read status entry).

      - **Email Headers**:

        - From: `"No Reply" <twoem.website@gmail.com>`
        - To: student.email
        - Reply-To: <twoemcyber@gmail.com>
        - Subject: e.g., "New Notification -- Twoem Online Productions"

  7.  **System Backup / Import**

      - **Manual Backup Upload**:

        - Admin can upload backup files (e.g., zipped database exports,
          CSV/JSON exports).
        - Size limit: configurable (e.g., 10MB).
        - Metadata:
          `{ ``storedName``, ``originalName``, description, ``uploadDate``, ``uploadedBy``, ``filePath``, ``createdAt`` }`
          stored in DB.
        - Store file in persistent storage (Render persistent disk or
          S3).

      - **Download Backups**:

        - Admin dashboard lists available backups; allow download via
          authenticated route.

      - **Export Current Data**:

        - Buttons to export DB collections/tables (students, fees,
          academics, resources, notifications, audit logs) as CSV or
          JSON.
        - Download immediately or store backup file automatically when
          changes are made with timestamp

      - **Import/Restore**:

        - Admin can upload exported backup file for restore or batch
          update.
        - Validate file format and contents carefully to avoid
          duplicates/integrity issues.

      - **Notifications**:

        - Optionally send email to admin via <twoem.website@gmail.com>
          upon successful backup or restore completion.

      - **Backup Reminders**:

        - Dashboard shows last backup date; remind admin if older than
          threshold (e.g., 1 days).

  8.  **Audit Logs**

      - **Storage**:

        - DB collection/table:
          `{ id``, ``adminUser``, ``actionType``, ``targetEntity`` (e.g., ``studentId``), details (JSON or text), timestamp, ``ipAddress`` }`.

      - **Admin UI**:

        - Filterable view: filter by date range, actionType, adminUser.
        - Pagination for large logs.

  9.  **Analytics Dashboard**

      - **Student Metrics**:

        - Total enrolled students.
        - Active vs. inactive (e.g., last login within X days).
        - Completion rates: % students with finalScore ≥ 60 AND fees
          cleared.
        - New registrations over time.

      - **Financial Metrics**:

        - Total fees collected by period (daily/weekly/monthly).
        - Total outstanding balances.
        - Payment trends graph.

      - **Resource Usage**:

        - Download counts per resource.
        - Most accessed resources.
        - Upcoming resource expiries.

      - **Visualization**:

        - Use Chart.js or similar for line charts, bar charts, pie
          charts.
        - Dashboard cards showing key stats.
        - Date-range filters to select period.

      - **Export**:

        - Export analytics data as CSV or PDF summary report.
        - Optionally send periodic summary email to admin via ,
          espicecially when any change is made via
          <twoem.website@gmail.com>.

  10. **Dark Mode / Accessibility**

      - Provide a toggle in header or settings for light/dark theme.
      - Persist preference in localStorage so user's choice persists
        across sessions.
      - Use Tailwind CSS dark mode classes.
      - Ensure all components work in both themes.
      - Accessibility: semantic HTML, ARIA labels, keyboard navigation,
        focus outlines, color contrast meeting WCAG guidelines.

- **Logout**:

  - Admin logout route clears session and redirects to `/admin/login`.

###   Student Portal (`Twoem`` | Student`) {#student-portal-twoem-student}

- **Login URL**: `/student/login`

- **Dashboard Base URL**: `/student/dashboard` and other `/student/...`
  routes.

- **Title**:

  - Login Page: `Twoem`` | Student Login`
  - Dashboard and sub-pages: `Twoem`` | Student - <Section>`

- **Authentication**:

  - **Username**: Reg Number.

  - **Default Password**: `Portal@2025`. On first login, student must
    reset password.

  - **Password Storage**: bcrypt-hashed with `saltRounds` from env.

  - **First-Time Reset**:

    - When student logs in with default password OR
      `mustResetPassword``=true`, redirect to
      `/student/reset-password-first`.
    - Render form to enter new password and confirm.
    - On submission: validate match, hash new password, update student
      record (`passwordHash`, `mustResetPassword``=false`), set
      `req.session``.studentId`, redirect to dashboard.

  - **Forgot Password Flow**:

    - Student visits "Forgot Password" page: enter Reg Number or Email.

    - Backend: find student record if active.

    - Generate secure random token (e.g., 32 bytes hex), hash token
      (bcrypt or SHA256) and store in student record with expiry
      timestamp (`passwordResetTokenHash`,
      `passwordResetExpires`` = now + 1 hour`).

    - Send reset email via <twoem.website@gmail.com>:

      - From: `"No Reply" <twoem.website@gmail.com>`
      - To: student.email
      - Reply-To: <twoemcyber@gmail.com>
      - Subject: "Password Reset -- Twoem Online Productions"
      - Body: "Hello , click link to reset your password:
        https:///student/reset-password?token="

    - Reset link page: GET `/student/``reset-password?token``=...`:

      - Verify token by hashing rawToken and comparing to stored
        `passwordResetTokenHash`, and check
        `passwordResetExpires`` > now`.
      - If valid: render form to enter new password and confirm.
      - On submit: validate match, hash new password, update
        `passwordHash`, clear `passwordResetTokenHash` and
        `passwordResetExpires`, set `mustResetPassword``=false`,
        optionally auto-login and redirect to dashboard or redirect to
        login with success message.

- **Session Management**:

  - `express-session` with `SESSION_SECRET`; secure, HttpOnly cookies.
  - Session expiration policy (e.g., 1 hour inactivity).

- **Student Portal Sections**:

  1.  **Profile**:

      - Display: Full Name, Reg Number, Email, Enrollment Date.
      - Allow update of Email (requires confirmation?) and Password
        (change current password; verify current password).
      - Changing email may require re-verification or simply update and
        send notification email.

  2.  **Academics**:

      - Show marks for 8 units and 2 exam components.
      - Show final score calculation visually.
      - Show eligibility status: "Passed -- Eligible for certificate" or
        "Pending -- Fees outstanding / Average below 60%".
      - If eligible and certificate file exists (uploaded by admin),
        show "Download Certificate" button linking to authenticated
        route.
      - If eligible but not yet uploaded: show "Certificate pending
        upload by admin."
      - If not eligible: show reasons ("Fees outstanding", "Average
        below 60%").

  3.  **Fees**:

      - Table of payment history: each entry with Amount, Date,
        Reference Number.
      - Display current balance prominently.
      - If balance \> 0: show a reminder notice.
      - "Request Receipt Resend" button: sends past receipts email via
        <twoem.website@gmail.com>, replyTo <twoemcyber@gmail.com>.
      - (Future) "Pay Now" button linking to payment gateway
        integration.

  4.  **Resources**:

      - List active resources assigned to student's courses.
      - Each item: description, upload date, expiry date.
      - If expired: hide or mark "Expired".
      - Download link via authenticated route.
      - Search/filter by keywords or course.

  5.  **Notifications**:

      - Inbox-like list showing title, snippet, timestamp, unread
        indicator.
      - Click to view full message; mark as read.
      - Unread count badge shown in header.

  6.  **WiFi Info**:

      - Display SSID, Password, Connection Instructions, Disclaimer.
      - Option to copy password or instructions.

  7.  **Certificate Section**:

      - Show eligibility status and download if available.
      - If not eligible or not yet uploaded: show appropriate message.

  8.  **Support / Help**:

      - Form: Title, Description.
      - On submit: create support ticket record in DB:
        `{ ``studentId``, title, message, ``status:"Open``", ``createdAt`` }`.
      - Send email to admin via <twoem.website@gmail.com> with replyTo
        <twoemcyber@gmail.com>: "New Support Request from (RegNumber):

      <!-- -->

      - ".

      <!-- -->

      - Student sees acknowledgement and can view ticket status updates
        in portal.
      - Admin UI handles support tickets: view, respond, update status;
        responses trigger email to student via
        <twoem.website@gmail.com>.

  9.  **Theme & Accessibility Settings**:

      - Toggle light/dark mode persisted in localStorage.
      - Font-size adjustment controls.

  10. **Logout**:

  - Button/link to destroy session (`req.session``.``destroy``(``)`),
    redirect to `/student/login`.

- **UI/UX**:

  - Responsive layout: sidebar or top nav in dashboard, depending on
    screen size.
  - Use Tailwind CSS classes for cards, tables, forms, buttons.
  - Loading indicators (spinners or skeletons) when fetching data.
  - Client-side validation for forms; server-side validation and
    sanitization.
  - Clear error/success feedback.
  - Tables for academics and fees: sortable columns, search/filter,
    pagination for long lists.
  - Progress bars or charts for academic progress.
  - Modals for confirmations (e.g., logout, destructive actions).
  - Breadcrumbs for navigation context.
  - Toast notifications for transient messages (e.g., "Profile updated
    successfully").
  - Accessibility: ARIA labels, keyboard navigation, high contrast.

### Student Password Reset

- **"Forgot Password" Page**: accessible from Student Login.

- **Form**: input Reg Number or Email.

- **Server Handling**:

  1.  Lookup student by Reg Number or Email; ensure `isActive``=true`.

  2.  Generate secure random token: e.g.,
      `crypto.randomBytes``(32``).``toString``('hex')`.

  3.  Hash token (e.g., `bcrypt.hash``(token, ``saltRounds``)` or
      SHA256) and store in student record:
      `{ ``passwordResetTokenHash``, ``passwordResetExpires``: ``Date.now``(``) + ``3600000 }`.

  4.  Send reset email via <twoem.website@gmail.com>:

      - From: `"No Reply" <twoem.website@gmail.com>`
      - To: student.email
      - Reply-To: <twoemcyber@gmail.com>
      - Subject: "Password Reset -- Twoem Online Productions"
      - Body: "Hello , click the following link to reset your password:
        https:///student/reset-password?token=. This link expires in 1
        hour."

  5.  Render confirmation: "If an account with that information exists,
      a reset link has been sent to your email."

### Automated Notifications & Receipts {#automated-notifications-receipts}

- **Use** `sendEmail` **utility** with <twoem.website@gmail.com> as
  sender and replyTo <twoemcyber@gmail.com> for:

  - Student welcome emails after registration.
  - Fee payment receipts.
  - Notifications (global and individual).
  - Academic results notifications.
  - Resource upload alerts.
  - Support ticket notifications (to student and admin).
  - Backup completion notifications (to admin).
