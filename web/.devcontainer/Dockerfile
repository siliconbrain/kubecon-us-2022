FROM node:18

ENV PORT 3000

WORKDIR /app
COPY . .
RUN npm install

CMD npm run dev -- -H 0.0.0.0
