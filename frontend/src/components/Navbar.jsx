import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import logo from '../assets/Logo.png';

const Navbar = ({ onWaitlistClick }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/90 backdrop-blur-md shadow-md' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src={logo} alt="Predictra" className="h-8 w-auto" />
            <span className="text-xl font-bold text-gray-900">
              Predictra
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">
              Features
            </a>
            <a href="#about" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">
              About
            </a>
            <a href="#pricing" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">
              Pricing
            </a>
            <button
              onClick={onWaitlistClick}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
            >
              Join Waitlist
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={onWaitlistClick}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg text-sm"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
