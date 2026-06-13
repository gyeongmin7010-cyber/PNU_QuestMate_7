# PNU QuestMate V7 Final

발표용 최종 정리판입니다.

## 핵심
- 사용자 화면에서 개발/진단/데모 표현 제거
- 학교 정보, AI 퀘스트, QR 인증, 스탬프북, 리워드만 노출
- 학습형 대표 미션: 새벽벌도서관 3시간 체류
- 스탬프: 하루 1개, 25개 만점
- 리워드: 배지, 쿠폰, 굿즈, 비교과 마일리지 신청, 우수 참여자 인증서

## 필수 경로
```txt
netlify/functions/pnu-data.js
netlify/functions/checkin.js
assets/pnu_mark.svg
assets/qr/
```

## 발표용 빠른 검증
일반 사용자 화면에는 보이지 않지만, 발표 중 기능 동작을 짧게 확인하려면 주소 뒤에 `?presenter=1`을 붙이면 1분 검증 모드가 활성화됩니다.
실제 운영 기준은 학습형 3시간 체류입니다.
