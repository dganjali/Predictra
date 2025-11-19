import React from 'react';
import { motion } from 'framer-motion';

const features = [
  {
    emoji: '📊',
    title: 'Real-Time Analytics',
    description: 'Monitor equipment health 24/7 with instant alerts and comprehensive dashboards.'
  },
  {
    emoji: '🤖',
    title: 'AI Predictions',
    description: 'Advanced machine learning predicts failures weeks in advance with 99.7% accuracy.'
  },
  {
    emoji: '💰',
    title: 'Cost Savings',
    description: 'Reduce maintenance costs by up to 45% through optimized scheduling.'
  },
  {
    emoji: '🔒',
    title: 'Enterprise Security',
    description: 'Bank-level encryption and compliance with industry standards.'
  },
  {
    emoji: '⚡',
    title: 'Easy Integration',
    description: 'Connect with existing systems through our flexible API in minutes.'
  },
  {
    emoji: '📱',
    title: 'Mobile Access',
    description: 'Monitor and manage maintenance from anywhere with our mobile app.'
  }
];

const Features = () => {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-2 mb-4 text-sm font-semibold text-purple-700 bg-purple-100 rounded-full"
          >
            Features
          </motion.span>
          
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4"
          >
            Everything you need to
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
              optimize maintenance
            </span>
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="max-w-2xl mx-auto text-xl text-gray-600"
          >
            Powerful features designed for manufacturers who want to prevent downtime and maximize efficiency.
          </motion.p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group p-8 bg-white rounded-2xl border-2 border-gray-100 hover:border-purple-200 hover:shadow-xl transition-all duration-300"
            >
              <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform duration-300">
                {feature.emoji}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-purple-600 transition-colors duration-300">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-full">
            <span className="text-purple-700 font-semibold">And many more features coming soon</span>
            <span className="text-2xl">🚀</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
