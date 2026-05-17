FROM nginx:1.25-alpine

RUN apk add --no-cache curl

RUN addgroup -S nginx && adduser -S nginx -G nginx

COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN mkdir -p /etc/nginx/certs && \
    chown -R nginx:nginx /etc/nginx/certs && \
    chmod 700 /etc/nginx/certs

RUN mkdir -p /var/log/nginx && \
    chown -R nginx:nginx /var/log/nginx

RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
