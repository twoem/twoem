exports.showServices = (req, res) => {
    const services = {
        printing: {
            title: "🖨️ Digital Printing & Design",
            image: "/images/digitalprint.jpeg",
            items: [
                "Business Cards",
                "Award Certificates",
                "Brochures",
                "Funeral Programs",
                "Handouts",
                "Flyers",
                "Maps",
                "Posters",
                "Letterheads",
                "Calendars"
            ],
            whatsapp: "I%20need%20Digital%20Printing%20Services"
        },
        government: {
            title: "🏛️ Government & Official Services",
            subsections: [
                {
                    title: "eCitizen Services",
                    image: "/images/ecitizen1.jpeg",
                    items: [
                        "Passport Application & Renewal (Adults & Children)",
                        "Certificate of Good Conduct (DCI Police Clearance)",
                        "Birth & Death Certificate Applications",
                        "Marriage Registration & Licensing",
                        "CRB Clearance Certificate",
                        "HELB Loan Application & Clearance",
                        "TSC Number Application & GHRIS Payslip Access",
                        "NHIF & NSSF Registration",
                        "Business Name Search & Registration",
                        "Company Registration",
                        "Land Rent Clearance Certificate & Official Land Search",
                        "Driving License Renewal & NTSA Bookings"
                    ],
                    whatsapp: "I%20need%20eCitizen%20Services"
                },
                {
                    title: "iTax (KRA) Services",
                    image: "/images/itax.jpeg",
                    items: [
                        "New KRA PIN Registration (Individual & Company)",
                        "Group PIN Registration",
                        "Tax Returns Filing (Annual & Nil Returns)",
                        "Tax Compliance Certificate Application",
                        "PIN Retrieval & Update",
                        "Certificate Reprinting",
                        "iTax Account Assistance & Recovery"
                    ],
                    whatsapp: "I%20need%20iTax%20Services"
                }
            ]
        },
        office: {
            title: "📄 Office & Digital Services",
            image: "/images/Services.jpeg",
            items: [
                "Photocopying",
                "Printing (Black & White / Colour)",
                "Document Typing & Editing",
                "Scanning (Document & Photo)",
                "Binding (Comb & Wire) & Lamination",
                "Instant Passport Photos"
            ],
            whatsapp: "I%20need%20Office%20Services"
        },
        internet: {
            title: "🌐 Internet Services",
            image: "/images/Browsing.jpeg",
            items: [
                "High-Speed Browsing (1/- per minute)",
                "Online Form Submission & Email Setup",
                "Account Creation (Email, Social, Government)",
                "Online Application Support"
            ],
            whatsapp: "I%20need%20Internet%20Services"
        },
        computer: {
            title: "🖥️ Computer & Support Services",
            items: [
                "Computer Students Online Portal and Classes",
                "Design & Layout",
                "Map & Poster Design",
                "Award Certificate Design",
                "Business Card Layout"
            ],
            whatsapp: "I%20need%20Support%20Services"
        }
    };

    res.render('services', {
        title: 'Twoem | Services',
        currentPage: 'services',
        services
    });
};
