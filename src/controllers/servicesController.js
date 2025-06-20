exports.showServices = (req, res) => {
    const services = {
        printing: {
            title: "Digital Printing & Design",
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
        // Other service categories...
    };

    res.render('services', {
        title: 'Twoem | Services',
        currentPage: 'services',
        services
    });
};
