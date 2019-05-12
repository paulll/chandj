# ChanDJ Bot

Telegram bot for playlist normalization  

## Usage:

1. Send mp3 file or link to youtube-dl compatible service
2. Bot will fix track metadata, recode it with lame and send back, replacing source message

## Running it yourself:

1. Obtain required access tokens and set them in environment variables
    - [Telegram Client API Key & ID](https://my.telegram.org)
    - [Telegram Bot Token](https://t.me/BotFather)
    - [AcoustID API Key](https://acoustid.org/new-application)
2. run `docker run -d -e "TG_API_ID=..." -e "TG_API_HASH=..." paulll/chandj`

## Installation from source:

1. Obtain required access tokens and set them in environment variables
    - [Telegram Client API Key & ID](https://my.telegram.org)
    - [Telegram Bot Token](https://t.me/BotFather)
    - [AcoustID API Key](https://acoustid.org/new-application)
2. Install requirements (lame, sox)    
3. You may need to copy `libtdjson.so` file from tdlib to project root

    
