FROM akhmetov/tdlib

# System requirements
# todo: move (g++, g++, make, python) to temporary container
RUN apk add --update nodejs nodejs-npm lame sox ffmpeg git python make gcc  g++ \
    && apk add chromaprint --repository="http://dl-cdn.alpinelinux.org/alpine/edge/testing" \
    && mkdir -p /opt/app \
    && ln -s /usr/local/lib/libtdjson.so /opt/app/libtdjson.so

WORKDIR /opt/app

# Dependencies are updated less frequent than main code
COPY package.json package-lock.json /opt/app/
RUN npm ci

COPY . /opt/app
CMD [ "/usr/bin/node", "/opt/app/index.js" ]