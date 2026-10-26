<?php

namespace App\Mail;

use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mime\Email;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;

class ResendTransport extends AbstractTransport
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
        $fromStr = $from ? ($from->getName() ? "{$from->getName()} <{$from->getAddress()}>" : $from->getAddress()) : 'JMCFI PostFlow <onboarding@resend.dev>';

        $toAddresses = [];
        foreach ($email->getTo() as $to) {
            $toAddresses[] = $to->getAddress();
        }

        if (empty($toAddresses)) {
            return;
        }

        $payload = [
            'from'    => $fromStr,
            'to'      => $toAddresses,
            'subject' => $email->getSubject() ?: 'Notification from JMCFI PostFlow',
        ];

        $htmlBody = $email->getHtmlBody();
        $textBody = $email->getTextBody();

        if (!empty($htmlBody)) {
            $payload['html'] = (string) $htmlBody;
        }
        if (!empty($textBody)) {
            $payload['text'] = (string) $textBody;
        }
        if (empty($payload['html']) && empty($payload['text'])) {
            $payload['text'] = ' ';
        }

        try {
            $client = new Client();
            $client->post('https://api.resend.com/emails', [
                'headers' => [
                    'Authorization' => 'Bearer ' . $this->apiKey,
                    'Content-Type'  => 'application/json',
                ],
                'json'    => $payload,
                'timeout' => 15,
            ]);

            $recipientList = implode(', ', $toAddresses);
            Log::info("Email sent via Resend API to: {$recipientList}");
        } catch (\GuzzleHttp\Exception\ClientException $ge) {
            $respBody = (string) $ge->getResponse()?->getBody();
            Log::error("Resend Transport API Error: {$respBody}");
            throw new \RuntimeException("Resend API Error: " . ($respBody ?: $ge->getMessage()));
        } catch (\Exception $e) {
            Log::error("Resend Transport Exception: " . $e->getMessage());
            throw $e;
        }
    }

    public function __toString(): string
    {
        return 'resend';
    }
}
