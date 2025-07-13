const Student = require('../models/Student');

// @desc    Get Student Dashboard
// @route   GET /student/dashboard
// @access  Private (Student)
exports.getStudentDashboard = async (req, res) => {
    try {
        // req.user is populated by the 'protectStudent' middleware chain
        const student = await Student.findById(req.user.id).select('-password');

        if (!student) {
            // Should not happen if protect middleware is working correctly
            req.flash('error_msg', 'Student not found. Please login again.');
            return res.redirect('/student/login');
        }

        res.render('student/dashboard', { // Will rename placeholder to dashboard.ejs
            pageTitle: `Student Portal | Dashboard - ${student.firstName}`,
            user: student,
            formatDate: (dateString) => {
                if (!dateString) return 'N/A';
                const options = { year: 'numeric', month: 'long', day: 'numeric' }; // Simpler date format
                return new Date(dateString).toLocaleDateString(undefined, options);
            },
            formatCurrency: (amount) => {
                 if (typeof amount !== 'number') return 'N/A';
                 return amount.toFixed(2);
            }
        });
    } catch (err) {
        console.error('Error fetching student dashboard:', err);
        // Attempt to render the dashboard with an error message
        // Pass req.user if available, otherwise it might be null
        const userForErrorPage = req.user ? await Student.findById(req.user.id).select('-password').lean() : null;
        res.status(500).render('student/dashboard', {
            pageTitle: 'Student Portal | Dashboard',
            user: userForErrorPage,
            error: 'Server error loading dashboard. Please try again later.',
            success: null,
            formatDate: (date) => date ? new Date(date).toLocaleDateString() : 'N/A',
            formatCurrency: (amount) => typeof amount === 'number' ? amount.toFixed(2) : 'N/A'
        });
    }
};

// @desc    Get Student Resources Page
// @route   GET /student/resources
// @access  Private (Student)
exports.getResourcesPage = async (req, res) => {
    try {
        // Simulate fetching resources. In a real app, this would come from a database.
        const sampleResources = [
            {
                id: 'res001',
                title: 'Introduction to Computers - Lecture Notes PDF',
                description: 'Comprehensive notes covering the basics of computer hardware, software, and operating systems.',
                fileUrl: '/sample_resources/intro_to_computers.pdf', // Placeholder URL
                uploadDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
            },
            {
                id: 'res002',
                title: 'MS Word Tutorial Video',
                description: 'A step-by-step video guide to mastering essential MS Word features.',
                fileUrl: 'https://www.youtube.com/watch?v=exampleVideoID', // Placeholder external link
                uploadDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
            },
            {
                id: 'res003',
                title: 'Keyboard Shortcuts Cheatsheet',
                description: 'A handy list of common keyboard shortcuts for faster typing and navigation.',
                content: `Ctrl+C: Copy\nCtrl+V: Paste\nCtrl+X: Cut\nCtrl+Z: Undo\nCtrl+S: Save\n... many more ...`, // Inline content example
                uploadDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
            }
        ];

        const wifiDetails = {
            ssid: process.env.WIFI_SSID || null, // Example: 'CampusStudentWiFi'
            password: process.env.WIFI_PASSWORD || null // Example: 'StudentAccess@2024'
        };

        // Fetch basic student info for the header/footer or any user-specific context needed
        const student = await Student.findById(req.user.id).select('firstName').lean();

        res.render('student/resources', {
            pageTitle: 'Student Portal | Resources',
            user: student, // Basic user info for layout
            resources: sampleResources,
            wifiDetails: wifiDetails,
            formatDate: (dateString) => { // Re-provide formatDate if not globally available to views
                if (!dateString) return 'N/A';
                const options = { year: 'numeric', month: 'long', day: 'numeric' };
                return new Date(dateString).toLocaleDateString(undefined, options);
            }
        });

    } catch (err) {
        console.error('Error fetching student resources page:', err);
        const userForErrorPage = req.user ? await Student.findById(req.user.id).select('firstName').lean() : null;
        res.status(500).render('student/resources', {
            pageTitle: 'Student Portal | Resources',
            user: userForErrorPage,
            resources: [],
            wifiDetails: { ssid: null, password: null },
            error: 'Server error loading resources. Please try again later.',
            success: null,
            formatDate: (date) => date ? new Date(date).toLocaleDateString() : 'N/A'
        });
    }
};

// @desc    Get Student Financial Page
// @route   GET /student/financial
// @access  Private (Student)
exports.getFinancialPage = async (req, res) => {
    try {
        const student = await Student.findById(req.user.id)
            .select('firstName lastName registrationNumber feesBalance') // Select only needed fields
            .lean();

        if (!student) {
            req.flash('error_msg', 'Student not found. Please login again.');
            return res.redirect('/student/login');
        }

        res.render('student/financial', {
            pageTitle: 'Student Portal | Finance',
            user: student, // For header/footer and basic info like registrationNumber
            studentData: { // Specific data for this page
                feesBalance: student.feesBalance
            },
            formatCurrency: (amount) => {
                 if (typeof amount !== 'number') return 'N/A';
                 return amount.toFixed(2);
            }
        });

    } catch (err) {
        console.error('Error fetching student financial page:', err);
        const userForErrorPage = req.user ? await Student.findById(req.user.id).select('firstName registrationNumber').lean() : null;
        res.status(500).render('student/financial', {
            pageTitle: 'Student Portal | Finance',
            user: userForErrorPage,
            studentData: null,
            error: 'Server error loading financial details. Please try again later.',
            success: null,
            formatCurrency: (amount) => typeof amount === 'number' ? amount.toFixed(2) : 'N/A'
        });
    }
};

// @desc    Render Student Update Profile Page
// @route   GET /student/update-profile
// @access  Private (Student)
exports.getStudentUpdateProfilePage = async (req, res) => {
    try {
        const student = await Student.findById(req.user.id).select('firstName nextOfKinName nextOfKinPhone');
        if (!student) {
            req.flash('error_msg', 'Student not found.');
            return res.redirect('/student/login');
        }
        res.render('student/update-profile', {
            pageTitle: 'Update Profile | Student Portal',
            user: student // Pass only necessary fields or full user if form needs more
        });
    } catch (err) {
        console.error('Error getting student update profile page:', err);
        req.flash('error_msg', 'Could not load profile update page.');
        res.redirect('/student/dashboard');
    }
};

// @desc    Handle Student Profile Update (Next of Kin)
// @route   POST /student/update-profile
// @access  Private (Student)
exports.updateStudentProfile = async (req, res) => {
    const { nextOfKinName, nextOfKinPhone } = req.body;
    const studentId = req.user.id;

    // Validation
    const errors = [];
    if (!nextOfKinName || nextOfKinName.trim() === '') {
        errors.push('Next of Kin Name is required.');
    }
    if (!nextOfKinPhone || nextOfKinPhone.trim() === '') {
        errors.push('Next of Kin Phone Number is required.');
    } else if (!/^(0[17][0-9]{8})$/.test(nextOfKinPhone.trim())) {
        errors.push('Invalid Next of Kin phone number format (e.g., 0712345678).');
    }

    if (errors.length > 0) {
        // Fetch student data again to pass to the view for re-rendering with values
        const studentForView = await Student.findById(studentId).select('firstName nextOfKinName nextOfKinPhone');
        return res.status(400).render('student/update-profile', {
            pageTitle: 'Update Profile | Student Portal',
            user: studentForView, // Pass existing or attempted data back
            error: errors.join(' '), // Concatenate errors
            success: null
        });
    }

    try {
        const student = await Student.findById(studentId);
        if (!student) {
            // Should not happen if user is authenticated via protectStudent
            req.flash('error_msg', 'Student not found. Please login again.');
            return res.redirect('/student/login');
        }

        student.nextOfKinName = nextOfKinName.trim();
        student.nextOfKinPhone = nextOfKinPhone.trim();
        // The pre-save hook on Student model will set profileRequiresUpdate to false
        // student.profileRequiresUpdate = false; // Explicitly set here or rely on hook

        await student.save();

        // req.user might be stale after save, but for redirect message it's fine
        req.user.nextOfKinName = student.nextOfKinName; // Update req.user for immediate reflection if needed by other middleware (unlikely here)
        req.user.nextOfKinPhone = student.nextOfKinPhone;
        req.user.profileRequiresUpdate = student.profileRequiresUpdate;


        req.flash('success_msg', 'Profile (Next of Kin information) updated successfully!');
        res.redirect('/student/dashboard');

    } catch (err) {
        console.error('Error updating student profile:', err);
        const studentForView = await Student.findById(studentId).select('firstName nextOfKinName nextOfKinPhone');
        res.status(500).render('student/update-profile', {
            pageTitle: 'Update Profile | Student Portal',
            user: studentForView,
            error: 'Server error while updating profile. Please try again.',
            success: null
        });
    }
};

// @desc    Get Student Academics Page
// @route   GET /student/academics
// @access  Private (Student)
exports.getAcademicsPage = async (req, res) => {
    try {
        const student = await Student.findById(req.user.id)
            .select('-password')
            .lean(); // Use .lean() for plain JS objects if not modifying/saving

        if (!student) {
            req.flash('error_msg', 'Student not found. Please login again.');
            return res.redirect('/student/login');
        }

        const definedTopics = [
            'Introduction to Computers', 'Keyboard Management', 'Ms Word', 'Ms Excel',
            'Ms Publisher', 'Ms PowerPoint', 'Ms Access', 'Internet and Email'
        ];

        let topicScores = [];
        let topicSum = 0;
        let topicsGradedCount = 0;

        definedTopics.forEach(topicName => {
            const record = student.academicRecords ? student.academicRecords.find(r => r.topic === topicName) : null;
            if (record && typeof record.score === 'number') {
                topicScores.push({ topic: topicName, score: record.score });
                topicSum += record.score;
                topicsGradedCount++;
            } else {
                topicScores.push({ topic: topicName, score: null }); // Still list it as not tested
            }
        });

        const topicAverage = topicsGradedCount > 0 ? topicSum / topicsGradedCount : null;
        // According to requirements, all 8 topics contribute to the average.
        // If any topic is not filled, the average calculation for the 30% might be considered incomplete.
        // Let's assume for now the average is of graded topics. Admin should fill all.
        // A stricter rule: if topicsGradedCount < definedTopics.length, then topicAverage is null for final grade calculation.

        const mainExamTheoryScore = student.mainExam && typeof student.mainExam.theoryScore === 'number' ? student.mainExam.theoryScore : null;
        const mainExamPracticalScore = student.mainExam && typeof student.mainExam.practicalScore === 'number' ? student.mainExam.practicalScore : null;

        let finalGradeInfo = {
            status: 'Pending', // Possible statuses: Pending, Complete, FailedIncomplete
            message: 'Data is incomplete for final grade calculation.',
            finalPercentage: null,
            letterGrade: null,
            gradeRemark: null,
            weightedTopicAverage: 0,
            weightedTheory: 0,
            weightedPractical: 0
        };

        // Check if all components for final grade are present
        const allTopicsGraded = topicsGradedCount === definedTopics.length;

        if (allTopicsGraded && topicAverage !== null && mainExamTheoryScore !== null && mainExamPracticalScore !== null) {
            const weightedTopicAvg = (topicAverage / 100) * 30;
            const weightedTheory = (mainExamTheoryScore / 100) * 35;
            const weightedPractical = (mainExamPracticalScore / 100) * 35;
            const finalPercentage = weightedTopicAvg + weightedTheory + weightedPractical;

            let letterGrade = 'F';
            let gradeRemark = 'Fail';

            // Proposed Grading Scale:
            // 90-100: A+ (Distinction)
            // 80-89: A (Distinction)
            // 70-79: B (Credit)
            // 60-69: C (Credit)
            // 50-59: D (Pass)
            // Below 50: F (Fail)
            if (finalPercentage >= 90) { letterGrade = 'A+'; gradeRemark = 'Distinction'; }
            else if (finalPercentage >= 80) { letterGrade = 'A'; gradeRemark = 'Distinction'; }
            else if (finalPercentage >= 70) { letterGrade = 'B'; gradeRemark = 'Credit'; }
            else if (finalPercentage >= 60) { letterGrade = 'C'; gradeRemark = 'Credit'; }
            else if (finalPercentage >= 50) { letterGrade = 'D'; gradeRemark = 'Pass'; }

            finalGradeInfo = {
                status: 'Complete',
                message: 'Final grade calculated successfully.',
                finalPercentage: finalPercentage,
                letterGrade: letterGrade,
                gradeRemark: gradeRemark,
                weightedTopicAverage: weightedTopicAvg,
                weightedTheory: weightedTheory,
                weightedPractical: weightedPractical
            };
        } else {
            // If grades are incomplete
            let missingParts = [];
            if (!allTopicsGraded) missingParts.push(`${definedTopics.length - topicsGradedCount} topic scores`);
            if (mainExamTheoryScore === null) missingParts.push("Main Exam Theory score");
            if (mainExamPracticalScore === null) missingParts.push("Main Exam Practical score");

            finalGradeInfo.message = `Missing: ${missingParts.join(', ')}.`;

            if (student.isStudiesComplete) { // Admin marked complete, but grades missing
                finalGradeInfo.status = 'FailedIncomplete';
                finalGradeInfo.message = `Studies marked as complete, but the following are missing: ${missingParts.join(', ')}. This results in a failing status.`;
            }
        }

        // Prepare studentData for the view
        const studentDataForView = {
            ...student, // Includes original student fields like isStudiesComplete, mainExamScheduledDate
            definedTopics: definedTopics, // Pass the list of all topics for iteration in EJS
            academicRecords: topicScores, // Pass the processed scores (with null for non-tested)
            topicAverage: topicAverage,
            mainExam: { // Ensure mainExam object exists for EJS checks
                theoryScore: mainExamTheoryScore,
                practicalScore: mainExamPracticalScore
            },
            finalGradeInfo: finalGradeInfo
        };

        res.render('student/academics', {
            pageTitle: 'Student Portal | Academics',
            user: student, // req.user basic info for header/footer if needed
            studentData: studentDataForView, // Detailed data for academics page content
            success: req.query.success || null,
            error: req.query.error || null,
            formatDate: (dateString) => {
                if (!dateString) return 'N/A';
                const options = { year: 'numeric', month: 'long', day: 'numeric' };
                return new Date(dateString).toLocaleDateString(undefined, options);
            }
        });

    } catch (err) {
        console.error('Error fetching student academics page:', err);
        // Try to render with an error message, using req.user for basic layout if possible
        const userForErrorPage = req.user ? await Student.findById(req.user.id).select('firstName').lean() : null;
        res.status(500).render('student/academics', {
            pageTitle: 'Student Portal | Academics',
            user: userForErrorPage,
            studentData: null, // No data to display
            error: 'Server error loading academic details. Please try again later.',
            success: null,
             formatDate: (date) => date ? new Date(date).toLocaleDateString() : 'N/A',
        });
    }
};


// Other student-specific controller functions (Financial, Resources) will go here later.
