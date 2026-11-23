<?php

namespace App\Mail;

use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mime\Email;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;

class BrevoTransport extends AbstractTransport
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
        $fromEmail = $from ? $from->getAddress() : config('mail.from.address', 'postflow@jmc.edu.ph');
        $fromName  = $from ? ($from->getName() ?: config('mail.from.name', 'JMCFI PostFlow')) : config('mail.from.name', 'JMCFI PostFlow');

        $toAddresses = [];
        foreach ($email->getTo() as $to) {
            $toAddresses[] = [
                'email' => $to->getAddress(),
                'name'  => $to->getName() ?: $to->getAddress(),
            ];
        }

        if (empty($toAddresses)) {
            return;
        }

        $payload = [
            'sender'  => [
                'name'  => $fromName,
                'email' => $fromEmail,
            ],
            'to'      => $toAddresses,
            'subject' => $email->getSubject() ?: 'Notification from JMCFI PostFlow',
        ];

        $htmlBody = $email->getHtmlBody();
        $textBody = $email->getTextBody();

        if (!empty($htmlBody)) {
            $payload['htmlContent'] = (string) $htmlBody;
        }
        if (!empty($textBody)) {
            $payload['textContent'] = (string) $textBody;
        }
        if (empty($payload['htmlContent']) && empty($payload['textContent'])) {
            $payload['textContent'] = ' ';
        }

        try {
            $client = new Client();
            $client->post('https://api.brevo.com/v3/smtp/email', [
                'headers' => [
                    'api-key'      => $this->apiKey,
                    'accept'       => 'application/json',
                    'content-type' => 'application/json',
                ],
                'json'    => $payload,
                'timeout' => 15,
            ]);

            $recipientList = implode(', ', array_column($toAddresses, 'email'));
            Log::info("Email sent via Brevo API to: {$recipientList}");
        } catch (\GuzzleHttp\Exception\ClientException $ge) {
            $respBody = (string) $ge->getResponse()?->getBody();
            Log::error("Brevo Transport API Error: {$respBody}");
            throw new \RuntimeException("Brevo API Error: " . ($respBody ?: $ge->getMessage()));
        } catch (\Exception $e) {
            Log::error("Brevo Transport Exception: " . $e->getMessage());
            throw $e;
        }
    }

    public function __toString(): string
    {
        return 'brevo';
    }
}
