<?php

namespace App\Mail;

use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mime\Email;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;

class SendGridTransport extends AbstractTransport
{
    protected string $apiKey;

    public function __construct(string $apiKey)
    {
        parent::__construct();
        $this->apiKey = trim(str_replace(' ', '', $apiKey));
    }

    protected function doSend(SentMessage $message): void
    {
        $email = $message->getOriginalMessage();
        if (!$email instanceof Email) {
            return;
        }

        $fromAddresses = $email->getFrom();
        $from = !empty($fromAddresses) ? $fromAddresses[0] : null;

        $toAddresses = [];
        foreach ($email->getTo() as $to) {
            $toAddresses[] = [
                'email' => $to->getAddress(),
                'name'  => $to->getName() ?: $to->getAddress()
            ];
        }

        if (empty($toAddresses)) {
            return;
        }

        $payload = [
            'personalizations' => [
                ['to' => $toAddresses]
            ],
            'from' => [
                'email' => $from ? $from->getAddress() : 'postflow@jmc.edu.ph',
                'name'  => $from ? ($from->getName() ?: 'JMCFI PostFlow') : 'JMCFI PostFlow',
            ],
            'subject' => $email->getSubject() ?: 'Notification from JMCFI PostFlow',
            'content' => []
        ];

        $htmlBody = $email->getHtmlBody();
        $textBody = $email->getTextBody();

        if (!empty($textBody)) {
            $payload['content'][] = [
                'type'  => 'text/plain',
                'value' => (string) $textBody,
            ];
        }

        if (!empty($htmlBody)) {
            $payload['content'][] = [
                'type'  => 'text/html',
                'value' => (string) $htmlBody,
            ];
        }

        if (empty($payload['content'])) {
            $payload['content'][] = [
                'type'  => 'text/plain',
                'value' => ' ',
            ];
        }

        try {
            $client = new Client();
            $client->post('https://api.sendgrid.com/v3/mail/send', [
                'headers' => [
                    'Authorization' => 'Bearer ' . $this->apiKey,
                    'Content-Type'  => 'application/json',
                ],
                'json'    => $payload,
                'timeout' => 15,
            ]);

            $recipientList = implode(', ', array_column($toAddresses, 'email'));
            Log::info("Email sent via SendGrid API to: {$recipientList}");
        } catch (\GuzzleHttp\Exception\ClientException $ge) {
            $respBody = (string) $ge->getResponse()?->getBody();
            Log::error("SendGrid Transport API Error: {$respBody}");
            throw new \RuntimeException("SendGrid API Error: " . ($respBody ?: $ge->getMessage()));
        } catch (\Exception $e) {
            Log::error("SendGrid Transport Exception: " . $e->getMessage());
            throw $e;
        }
    }

    public function __toString(): string
    {
        return 'sendgrid';
    }
}
