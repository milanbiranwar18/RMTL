import React from 'react';
import { motion } from 'framer-motion';

// Remounted per-route (via `key` in Layout) so every navigation gets a fresh, subtle fade-in.
const PageTransition = ({ children }) => (
    <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
    >
        {children}
    </motion.div>
);

export default PageTransition;
