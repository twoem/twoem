// Code to handle dynamic movement of images in the gallery
let galleryImages = document.querySelectorAll('.gallery-item');
let currentIndex = 0;

function showNextImage() {
    galleryImages[currentIndex].style.display = 'none';
    currentIndex = (currentIndex + 1) % galleryImages.length;
    galleryImages[currentIndex].style.display = 'block';
}

// Initially display the first image
galleryImages[currentIndex].style.display = 'block';
setInterval(showNextImage, 3000);  // Change image every 3 seconds
