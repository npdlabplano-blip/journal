FROM nginx:alpine

# git + bash for periodic pulls from GitHub
RUN apk add --no-cache git bash

# Static site files
COPY index.html base.css style.css app.js /var/www/news/
COPY pages/ /var/www/news/pages/
COPY data/ /var/www/news/data/

# Nginx config
COPY nginx-news.conf /etc/nginx/conf.d/default.conf

# Entrypoint (git pull loop + nginx)
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
