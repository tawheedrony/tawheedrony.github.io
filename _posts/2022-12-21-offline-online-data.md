---
layout: post
title:  Addressing Offline and Online Data Inconsistencies
date:   21-12-2022 00:00:00
description: My experience working in a popular offline game
tags: gaming links
categories: experience
---
There has always been a discrepancy between online data stored in your database repository and offline sales or user data. One of the biggest difficulties in developing the data pipeline for games or applications is this. I'll try to share the three lessons I learned from dealing with this problem in the past.

Launch the app across various app networks: It is necessary to evaluate how well the app performs when there are weak signals and data transitions. Jitters occur when data collection is delayed because the packets scatter the data among the senders and receivers. Users may receive a notification to upgrade their network connection in such circumstances. Another potential area of research is packet loss. Our system must either resend the data request in the event of a complete packet loss or alert the end user. systems for thorough network monitoring, including caching and troubleshooting

Check out the system's database-related features : Most modern mobile applications are API-driven. To keep track of the app's requests and responses, we can use a proxy. For the purpose of identifying deadlock and data loss and alerting the software team to address the problem, we can perform SQL, performance, and security testing. A data engineer's primary goal is to improve the data quality of the organization.

Things about data mismatch that are obvious: Data loss can occur occasionally as a result of batch processing and trimming, as is obvious. Furthermore, cross-functional programs like Appsflyer acknowledge that they can gather 70% of a user's data. You are left with no choice but to follow the remaining users in such circumstances.