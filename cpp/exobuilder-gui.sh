#!/bin/bash
set -- $(stat --format '%a' ./resources)
if [[$1 != 777]]; then 
    sudo chmod 777 ./ -R
fi
set -- $(stat --format '%a' ./chrome-sandbox)
if [[$1 != 4755]]; then
    sudo chown root:root chrome-sandbox
    sudo chmod 4755 chrome-sandbox
fi
./engine