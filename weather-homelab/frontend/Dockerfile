FROM nginx:alpine

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy all frontend files to nginx html directory
COPY index.html /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/

# Copy all chart JavaScript files
COPY charts-helpers.js /usr/share/nginx/html/
COPY charts-temperature.js /usr/share/nginx/html/
COPY charts-precipitation.js /usr/share/nginx/html/
COPY charts-uv.js /usr/share/nginx/html/
COPY charts-sun.js /usr/share/nginx/html/
COPY charts-hourly.js /usr/share/nginx/html/

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]