export type SiteConfig = {
name: string;
title: string;
shortBio: string;
location: string;
email: string;
phone: string;
profileImage: string;

socialLinks: {
whatsapp: string;
linkedin: string;
instagram: string;
facebook: string;
youtube: string;
tiktok: string;
};

sections: {
about: boolean;
services: boolean;
experience: boolean;
education: boolean;
skills: boolean;
projects: boolean;
testimonials: boolean;
insights: boolean;
contact: boolean;
};
};