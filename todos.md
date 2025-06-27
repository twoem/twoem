

### ✅ **Final Website Description for Twoem Online**

---

#### 🔷 **Website Identity**

* **Title Prefix**: `Twoem | Page Title` (e.g., `Twoem | Home`)
* **Official Email (Sender)**: `twoem.website@gmail.com`
* **Contact Receiver Email**: `twoemcyber@gmail.com`
* **Reply-To Tag**: All replies go to `twoemcyber@gmail.com`
* **Favicon**: `favicon.ico` in root
* **Logo**: `logo.png` (used in navbar/footer)
* **Hosted Downloads**: External links only, defined inside the code

---

#### 🔷 **Website Tabs/Sections**

* Home
* Services
* Downloads
* Student Portal
* Admin Login
* Contact
* Data Protection
* or any other relevant pages, 

---

#### 🔷 **Services Offered**

##### 🖨️ **Digital Printing**

* A4 & A3 Color Printing
* Black & White Printing
* Binding Services
* Business Cards
* Poster Printing
* Lamination

##### 🏛️ **Government Services**

* eCitizen Support
* NHIF Registration
* KRA Services
* ID Application
* Passport Services
* Birth Certificate Application

##### 🖥️ **Office Services**

* Typing Services
* Scanning & Copying
* CV Writing
* Document Editing
* Data Entry
* Translation (English & Swahili)

##### 🌐 **Internet Services**

* High-Speed WiFi
* Computer Access
* Email Setup
* Online Applications
* Social Media Setup
* File Downloads

##### 🎓 **Computer Education**

Courses offered under basic computer training:

1. Introduction to Computers
2. Keyboard Management
3. Microsoft Word
4. Microsoft Excel
5. Microsoft Publisher
6. Microsoft PowerPoint
7. Microsoft Access
8. Internet and Email
9. Main Exams – (35% Theory + 35% Practical)


 don't show gradings in the services part, but on student’s portals 
* **Coursework**: 30%
* **Main Exam**: 70%
* **Passing Grade**: 60%
* **Certificate Access**: Only if student clears fees & scores ≥ 60%

---

#### 🔷 **Downloads Page**

* Two Sections:

  * **Public Documents** (e.g., Curriculum Guides)
  * **Eulogy Documents** (Expire after 7 days)
* All download URLs are pasted **directly in code**, not uploaded via dashboard
* Admin uses external file hosting (Google Drive, Dropbox, etc.)
* Eulogy expires 7 days after upload
* Description and arrangements to be best
* 

---

#### 🔷 **Admin Portal**

* Admins login via `admin ID` or `email`
* Admin data (name, email, default password) is stored in `.env`
* Up to **three admins supported**
* Admin name shown in dashboard greeting (`Hello, <Admin Name>`)
* Admin sees which admin last updated student/fees
* Can:

  * Register new students
  * Reset student passwords
  * Send portal notifications
  * Manage courses, marks, and academic records
  * View/update fees, balances, and payment logs
  * Upload and manage study resources
  * Upload/change WiFi credentials & disclaimer
  * Upload backup file (manually or triggered)
  * View action logs per admin

---

#### 🔷 **Student Portal**

* Students log in via **Registration Number** and default password `Student@Twoem2025`
* Students must change password on first login
* Students must also fill in **Next of Kin** info after first login
* Can:

  * View academic scores
  * View/download certificate (and eligibility download)
  * Check fees balance and payment logs
  * Read notifications
  * View/download study resources
  * View WiFi credentials and policies

---

#### 🔷 **Contact Page**

* Integrated form
* Sends messages via `twoem.website@gmail.com`
* Auto forwards to `twoemcyber@gmail.com`
* Subject and message captured
* "Reply-To" automatically set to `twoemcyber@gmail.com`
* Configured using Gmail SMTP & App Password
* Add a perfectly working contact us form to send emails
* Add anything more to make this perfect

---

#### 🔷 **Image Usage**

* Icons/images sourced from **online/icon libraries**
* All required images are:

  * Logo → `logo.png`
  * Favicon → `favicon.ico`
* All icons for services rendered via a modern icon set (e.g., Feather Icons or Tabler Icons)
* Decorate the website perfectly with best images you can get
---

#### 🔷 **Environment Configuration (.env)**

> Private data like passwords/URLs stored in `.env` (not shown here)

Key Variables:

```env
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
PORT=10000
NODE_ENV=development
DATABASE_URL=...
DEFAULT_STUDENT_PASSWORD=Student@Twoem2025
SUPER_ADMIN_EMAIL=twoemcyber@gmail.com
JWT_SECRET=...
JWT_EXPIRE=365d
SMTP_USER=twoem.website@gmail.com
SMTP_PASS=...
EMAIL_FROM="Twoem Online Productions <twoem.website@gmail.com>"
DOWNLOAD_BASE_URL=https://drive.google.com/uc?export=download&id=
FORCE_PASSWORD_CHANGE=true
PASSWORD_MIN_LENGTH=8
PASSING_GRADE=60
AUTO_BACKUP_ENABLED=true
BACKUP_RETENTION_DAYS=30
BACKUP_ENCRYPTION_KEY=twoem-backup-key

ADD MORE RELEVANT LIKE ADMINS DETAILS TO LOG IN AND NAMES
```

---

*Student Login Page Features* 
---

### 🔐 **Student Login Page Features**

The **Student Login Page** offers three distinct, intuitive options to support secure and user-friendly access for learners:

---

#### 1. ✅ **Login**

* Students log in using their:

  * **Registration Number** (provided by admin)
  * **Password** (default or updated)
* On first login:

  * Forced password change is required
  * Student is prompted to complete personal profile, including **Next of Kin** details

---

#### 2. 🔁 **Forgot Password**

* For students who forget their credentials:

  * Prompted to enter:

    * **Registration Number**
    * **Registered Email Address**
  * System verifies both details against student records
  * If valid, a **6-character One-Time Reset Code** is sent to their email
  * Student uses this code to reset their password securely

---

#### 3. 🆕 **New Student? (One-Time Login Credentials)**

* Allows students who’ve been registered by an admin but haven't received login details to retrieve them
* Student provides:

  * **Email Address**
  * **First Name**
* If verified:

  * The system displays their **One-Time Login Credentials** (Registration Number + Temporary Password)
  * These credentials are **usable only once** per email
  * After first login, student must update password and profile

---


use best codes deployable on Render.com and ensure all codes are present ans perfect with no error to avoid deployment issues on onrender
