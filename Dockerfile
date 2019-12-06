FROM node

EXPOSE 80
COPY src/ /app/src
COPY package.json /app/package.json
COPY package-lock.json /app/package-lock.json
WORKDIR /app
RUN npm install . --production

ENTRYPOINT ["node", ".", "/var/test-sp/config.json"]